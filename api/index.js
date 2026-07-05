require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const JUP_API_KEY = process.env.JUP_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const RPC_URL = process.env.RPC_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Init DB
pool.query(`
  CREATE TABLE IF NOT EXISTS pnl_cards (
    id SERIAL PRIMARY KEY,
    wallet VARCHAR(255),
    nickname VARCHAR(255),
    pnl_pct FLOAT,
    pnl_usd FLOAT,
    tagline TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error("Error creating table:", err));

pool.query(`
  CREATE TABLE IF NOT EXISTS oracle_votes (
    id SERIAL PRIMARY KEY,
    vote_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error("Error creating votes table:", err));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Endpoint for Oracle chat
app.post('/api/oracle', async (req, res) => {
  try {
    const { messages, system } = req.body;
    
    // Construct messages array for Groq (system prompt goes first)
    const formattedMessages = [];
    if (system) {
      formattedMessages.push({ role: 'system', content: system });
    }
    formattedMessages.push(...messages);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: formattedMessages,
        max_tokens: 1000,
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Groq API Error:", data);
      return res.status(response.status).json({ error: 'Error from AI API' });
    }
    res.json({ content: data.choices[0].message.content });
  } catch (error) {
    console.error('Error handling /api/oracle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for PnL Tagline
app.post('/api/tagline', async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Groq API Error:", data);
      return res.status(response.status).json({ error: 'Error from AI API' });
    }
    res.json({ content: data.choices[0].message.content });
  } catch (error) {
    console.error('Error handling /api/tagline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for Token Info
app.get('/api/token-info', async (req, res) => {
  try {
    const response = await fetch('https://api.jup.ag/tokens/v2/search?query=9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump', {
      headers: {
        'x-api-key': JUP_API_KEY,
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching token info:', error);
    res.status(500).json({ error: 'Failed to fetch token info' });
  }
});

// Endpoint for Wallet Stats
app.post('/api/wallet-stats', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'Wallet address required' });
    
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          wallet,
          { mint: '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump' },
          { encoding: 'jsonParsed' }
        ]
      })
    });
    const data = await response.json();
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    
    let balance = 0;
    if (data.result && data.result.value && data.result.value.length > 0) {
      balance = data.result.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    }
    res.json({ balance });
  } catch (err) {
    console.error("RPC Error:", err);
    res.status(500).json({ error: 'Failed to fetch wallet stats' });
  }
});

// Endpoint for Leaderboard Post
app.post('/api/leaderboard', async (req, res) => {
  try {
    const { wallet, nickname, pnl_pct, pnl_usd, tagline } = req.body;
    await pool.query(
      'INSERT INTO pnl_cards (wallet, nickname, pnl_pct, pnl_usd, tagline) VALUES ($1, $2, $3, $4, $5)',
      [wallet || 'anon', nickname || 'anon', pnl_pct, pnl_usd, tagline]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("DB Insert Error:", err);
    res.status(500).json({ error: 'Failed to save card' });
  }
});

// Endpoint for Leaderboard Get
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pnl_cards ORDER BY pnl_pct DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    console.error("DB Select Error:", err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Endpoint for Oracle Votes
app.get('/api/votes', async (req, res) => {
  try {
    const result = await pool.query('SELECT vote_type, COUNT(*) as count FROM oracle_votes GROUP BY vote_type');
    const counts = { bull: 0, degen: 0, cope: 0 };
    result.rows.forEach(r => {
      counts[r.vote_type] = parseInt(r.count, 10);
    });
    res.json(counts);
  } catch (err) {
    console.error("DB Votes Select Error:", err);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

app.post('/api/votes', async (req, res) => {
  try {
    const { type } = req.body;
    if (['bull', 'degen', 'cope'].includes(type)) {
      await pool.query('INSERT INTO oracle_votes (vote_type) VALUES ($1)', [type]);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid vote type' });
    }
  } catch (err) {
    console.error("DB Vote Insert Error:", err);
    res.status(500).json({ error: 'Failed to save vote' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
