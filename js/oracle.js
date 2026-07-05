const SYSTEM_PROMPT = `You are the ANSEM ORACLE — the all-knowing, brutally honest AI advisor for the Ansem token community on Solana (CA: 9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump).

Your personality:
- You speak like a seasoned Solana degen who has seen 1000x coins and rug pulls alike
- You're honest, direct, sometimes darkly funny, but never reckless
- You use crypto slang naturally: ape in, paper hands, diamond hands, ngmi, gm, wen moon, ser, fren, cope, rekt, based, gigachad, normie, etc.
- You ALWAYS end with a disclaimer that you're not giving financial advice

Your knowledge:
- Deep understanding of Solana memecoin mechanics: liquidity, market cap, holder distribution, pump.fun dynamics
- You know how memecoin cycles work: launch → initial pump → consolidation → either rug or second leg
- You understand what makes a memecoin survive: community strength, narrative, influencer attention, LP status
- For Ansem specifically: it's a community token on Solana launched via pump.fun based on the Ansem brand/persona

When answering:
- Be specific and analytical, not vague
- Give bull case, base case, and cope case when relevant
- Call out red flags honestly
- Reference real Solana memecoin dynamics
- Keep responses punchy — 3-5 paragraphs max
- Use emojis sparingly but effectively

IMPORTANT: Always end with a single line: "🔮 Not financial advice, ser."`;

let liveStatsContext = "";
const messages = [];
let votes = { bull: 0, degen: 0, cope: 0 };
let voted = false;

function updateVoteDisplay() {
  document.getElementById('bull-count').textContent = votes.bull;
  document.getElementById('degen-count').textContent = votes.degen;
  document.getElementById('cope-count').textContent = votes.cope;
}

function castVote(type) {
  if (voted) return;
  voted = true;
  votes[type]++;
  updateVoteDisplay();
  const msgs = {
    bull: "Based. Diamond hands never quit. The Oracle sees your conviction. 💎",
    degen: "GIGACHAD behavior. You're either going to be rich or have a great story. 🚀",
    cope: "Ser... at least you're honest. The Oracle respects the self-awareness. 🧻"
  };
  addMessage('oracle', msgs[type]);
}

function quickAsk(q) {
  document.getElementById('user-input').value = q;
  sendMessage();
}

function addMessage(role, text) {
  const box = document.getElementById('chat-box');
  if(!box) return;
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-label">${role === 'oracle' ? 'ANSEM ORACLE' : 'YOU'}</div>
    <div class="msg-bubble">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function showTyping() {
  const box = document.getElementById('chat-box');
  if(!box) return;
  const div = document.createElement('div');
  div.className = 'msg oracle';
  div.id = 'typing-msg';
  div.innerHTML = `
    <div class="msg-label">ANSEM ORACLE</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing-msg');
  if (t) t.remove();
}

async function sendMessage() {
  const input = document.getElementById('user-input');
  const btn = document.getElementById('send-btn');
  const text = input.value.trim();
  if (!text) return;

  addMessage('user', text);
  input.value = '';
  btn.disabled = true;
  showTyping();

  messages.push({ role: 'user', content: text });

  try {
    const response = await fetch('/api/oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: SYSTEM_PROMPT + "\n\n" + liveStatsContext,
        messages: messages
      })
    });

    const data = await response.json();
    const reply = data.content || "The Oracle is meditating. Try again, ser.";

    messages.push({ role: 'assistant', content: reply });
    removeTyping();
    addMessage('oracle', reply);
  } catch (err) {
    removeTyping();
    addMessage('oracle', "The Oracle's crystal ball is foggy rn. Network issue. Try again, ser. 🔮");
  }

  btn.disabled = false;
  input.focus();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Fake seed votes for social proof
  votes.bull = Math.floor(Math.random() * 80) + 120;
  votes.degen = Math.floor(Math.random() * 60) + 80;
  votes.cope = Math.floor(Math.random() * 40) + 30;
  updateVoteDisplay();

  const input = document.getElementById('user-input');
  if(input) {
    input.addEventListener('keydown', (event) => {
      if(event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  // Fetch live stats immediately and poll every 30s
  fetchLiveStats();
  setInterval(fetchLiveStats, 30000);
});

// Fetch live token stats from backend
async function fetchLiveStats() {
  try {
    const res = await fetch('/api/token-info');
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    
    if (data && data.length > 0) {
      const token = data[0];
      
      const price = token.usdPrice;
      const mcap = token.mcap;
      const vol24h = token.stats24h?.volumeChange || 0;
      const priceChange24h = token.stats24h?.priceChange || 0;
      const liq = token.liquidity || 0;
      const holders = token.holderCount || 0;
      
      // Update global context for Oracle
      liveStatsContext = `
Live Data for $ANSEM (Updated just now):
- Price: $${price}
- Market Cap: $${mcap}
- 24h Vol Change: ${vol24h}%
- 24h Price Change: ${priceChange24h}%
- Liquidity: $${liq}
- Holders: ${holders}
`;
      
      // Update UI
      document.getElementById('live-stats').style.display = 'flex';
      
      document.getElementById('stat-price').textContent = '$' + (price < 0.01 ? price.toFixed(4) : price.toFixed(2));
      
      if (mcap > 1000000) {
        document.getElementById('stat-mcap').textContent = '$' + (mcap / 1000000).toFixed(1) + 'M';
      } else {
        document.getElementById('stat-mcap').textContent = '$' + mcap.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }
      
      const volEl = document.getElementById('stat-vol');
      volEl.textContent = (vol24h > 0 ? '+' : '') + vol24h.toFixed(1) + '%';
      volEl.className = 'stat-value ' + (vol24h >= 0 ? 'positive' : 'negative');
      
      const changeEl = document.getElementById('stat-change');
      changeEl.textContent = (priceChange24h > 0 ? '+' : '') + priceChange24h.toFixed(1) + '%';
      changeEl.className = 'stat-value ' + (priceChange24h >= 0 ? 'positive' : 'negative');
      
      document.getElementById('stat-liq').textContent = '$' + (liq > 1000000 ? (liq / 1000000).toFixed(1) + 'M' : (liq / 1000).toFixed(0) + 'K');
      document.getElementById('stat-holders').textContent = holders.toLocaleString();
    }
  } catch (error) {
    console.error('Error fetching live stats:', error);
  }
}
