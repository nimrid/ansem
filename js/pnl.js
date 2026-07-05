// ── TAGLINES ─────────────────────────────────────────────────────────
const WIN_LINES = [
  '"Started from the bottom, now my bags are heavy." 🚀',
  '"Told you ser. Diamond hands print money." 💎',
  '"The Oracle said gm. The Oracle was right." 🔮',
  '"I don\'t always ape in. But when I do, I hold." 🦍',
  '"ngmi? I think you meant ngmi for my gains." 📈',
  '"paper hands deleted from contacts." ✂️',
  '"My conviction was the alpha all along." 🧠',
];
const LOSS_LINES = [
  '"I\'m not down. I\'m early. Big difference." 🫡',
  '"This is fine. Everything is fine." 🔥',
  '"Down bad is just up bad in disguise." 📉',
  '"The chart goes down before it goes up. Probably." 😭',
  '"Just a temporary inconvenience on the road to Lambo." 🚗',
  '"Funds are SAFU. My mental health is not." 🫂',
];
const APE_LINES = [
  '"I came in when others doubted. I stay when others fold." 🦍',
  '"Average down they said. It\'s a strategy." 💀',
  '"Maximum conviction. Zero theta." 🎯',
  '"The only exit is the moon." 🌕',
];

// ── LEADERBOARD DATA ────────────────────────────────────────
let leaderboardData = [];

function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if(!list) return;
  
  if (leaderboardData.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">No degens yet. Be the first!</div>';
    return;
  }

  list.innerHTML = leaderboardData.map((row, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
    const rankLabel = rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : `#${rank}`;
    const pnlClass = row.pnl_pct >= 0 ? 'pos' : 'neg';
    const pnlStr = row.pnl_pct >= 0 ? `+${row.pnl_pct.toFixed(1)}%` : `${row.pnl_pct.toFixed(1)}%`;
    const displayAddr = row.wallet === 'anon' ? (row.nickname || 'anon') : (row.wallet.slice(0,6) + '...' + row.wallet.slice(-4));
    
    // Choose emoji based on pnl
    let emoji = '🫂';
    if (row.pnl_pct >= 200) emoji = '👑';
    else if (row.pnl_pct >= 100) emoji = '🔥';
    else if (row.pnl_pct >= 0) emoji = '📈';
    else if (row.pnl_pct <= -50) emoji = '😭';

    return `
      <div class="lb-row">
        <div class="lb-rank ${rankClass}">${rankLabel}</div>
        <div class="lb-addr">${displayAddr}</div>
        <div class="lb-badge">${emoji}</div>
        <div class="lb-pnl ${pnlClass}">${pnlStr}</div>
      </div>`;
  }).join('');
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (res.ok) {
      leaderboardData = await res.json();
      renderLeaderboard();
    }
  } catch (err) {
    console.error("Failed to load leaderboard:", err);
  }
}

// ── AUTO GENERATE ───────────────────────────────────────────────
async function autoGenerate() {
  const addr = document.getElementById('wallet-addr').value.trim();
  const nickname = document.getElementById('nickname').value.trim();
  
  if (!addr || addr.length < 32) {
    showToast('Enter a valid Solana wallet address first');
    return;
  }
  
  document.getElementById('loading').classList.add('show');
  document.getElementById('pnl-card').classList.remove('visible');
  document.getElementById('action-row').classList.remove('visible');
  
  showToast('🔮 Querying blockchain...');
  try {
    // 1. Get Wallet Balance
    const res = await fetch('/api/wallet-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: addr })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch wallet balance');
    
    let tokens = data.balance;
    if (tokens === 0) tokens = Math.random() * 5000000 + 10000; // Fake some tokens if they hold 0
    
    // 2. Get Current Price
    const tRes = await fetch('/api/token-info');
    const tData = await tRes.json();
    let currPriceUsd = 0.005; 
    if (tData && tData.length > 0) currPriceUsd = tData[0].usdPrice;
    
    const solUSD = 145; 
    const currPriceSOL = currPriceUsd / solUSD;
    
    // 3. Fake Average Buy Price to simulate a 1.5x to 15x gain (because the real avg buy price requires paid indexers!)
    const gainFactor = Math.random() * 13.5 + 1.5; 
    const buyPriceSOL = currPriceSOL / gainFactor;
    
    await generateCardCore(tokens, buyPriceSOL, currPriceSOL, solUSD, nickname, addr);

  } catch (err) {
    showToast('❌ ' + err.message);
    document.getElementById('loading').classList.remove('show');
  }
}

// ── GENERATE CARD ──────────────────────────────────────────────────
async function generateCardCore(tokens, buyPrice, currPrice, solUSD, nickname, wallet) {

  // Calc
  const pnlPct     = ((currPrice - buyPrice) / buyPrice) * 100;
  const pnlSOL     = (currPrice - buyPrice) * tokens;
  const pnlUSD     = pnlSOL * solUSD;
  const currentVal = currPrice * tokens * solUSD;
  const isWin      = pnlPct >= 0;
  const isMassiveW = pnlPct >= 200;
  const isMassiveL = pnlPct <= -50;

  // Get tagline from Claude
  let tagline = isWin
    ? WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)]
    : LOSS_LINES[Math.floor(Math.random() * LOSS_LINES.length)];

  try {
    const prompt = `A Solana memecoin degen just made a PnL card for $ANSEM token. Their stats:
- Tokens held: ${tokens.toLocaleString()}
- Avg buy price: ${buyPrice} SOL
- Current price: ${currPrice} SOL  
- PnL: ${pnlPct.toFixed(2)}%
- USD PnL: $${pnlUSD.toFixed(2)}
- Nickname: ${nickname || 'anonymous degen'}

Write ONE punchy, degen-flavored one-liner (max 12 words) for their PnL card. 
${isWin ? 'They are WINNING. Make it a flex.' : 'They are DOWN BAD. Make it cope-funny.'}
${isMassiveW ? 'They are absolutely printing. Make it legendary.' : ''}
${isMassiveL ? 'They are rekt. Dark humor is ok.' : ''}
Just the one-liner, nothing else, no quotes around it, no emoji count limit.`;

    const resp = await fetch('/api/tagline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const d = await resp.json();
    if (d.content) tagline = `"${d.content.replace(/^["']|["']$/g,'').trim()}"`;
  } catch(e) { /* fallback to static tagline */ }

  // Build card type
  const card = document.getElementById('pnl-card');
  card.className = 'pnl-card';
  let cardType, badgeText, badgeClass;

  if (pnlPct >= 100) {
    cardType = 'card-win'; badgeText = '🦍 GIGACHAD'; badgeClass = 'badge-win';
  } else if (pnlPct >= 0) {
    cardType = 'card-win'; badgeText = '💎 DIAMOND'; badgeClass = 'badge-win';
  } else if (pnlPct >= -30) {
    cardType = 'card-ape'; badgeText = '🫡 STILL EARLY'; badgeClass = 'badge-ape';
  } else {
    cardType = 'card-loss'; badgeText = '🧻 NGMI'; badgeClass = 'badge-loss';
  }

  card.classList.add(cardType);

  // Fill values
  document.getElementById('pnl-value').textContent   = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;
  document.getElementById('pnl-value').className     = `pnl-value ${isWin ? 'pnl-win' : pnlPct >= -30 ? 'pnl-ape' : 'pnl-loss'}`;
  document.getElementById('pnl-usd').textContent      = `${pnlUSD >= 0 ? '+' : ''}$${Math.abs(pnlUSD).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} USD`;
  document.getElementById('stat-entry').textContent   = formatPrice(buyPrice);
  document.getElementById('stat-now').textContent     = formatPrice(currPrice);
  document.getElementById('stat-tokens').textContent  = formatBig(tokens);
  document.getElementById('card-tagline').textContent = tagline;
  document.getElementById('card-badge').textContent   = badgeText;
  document.getElementById('card-badge').className     = `card-badge ${badgeClass}`;

  const displayAddr = wallet
    ? wallet.slice(0,6) + '...' + wallet.slice(-4)
    : (nickname || 'anon') + ' · ansem oracle';
  document.getElementById('card-wallet').textContent = displayAddr;

  // Add to leaderboard via API
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: wallet || 'anon',
        nickname: nickname || 'anon',
        pnl_pct: pnlPct,
        pnl_usd: pnlUSD,
        tagline: tagline
      })
    });
    // Reload leaderboard
    loadLeaderboard();
  } catch (err) {
    console.error("Leaderboard submit failed", err);
  }

  document.getElementById('loading').classList.remove('show');
  card.classList.add('visible');
  document.getElementById('action-row').classList.add('visible');

  // Scroll into view
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── SHARE ACTIONS ──────────────────────────────────────────────────
function getShareText() {
  const pnl   = document.getElementById('pnl-value').textContent;
  const usd   = document.getElementById('pnl-usd').textContent;
  const badge = document.getElementById('card-badge').textContent;
  const line  = document.getElementById('card-tagline').textContent;
  return `${badge} $ANSEM PnL CARD\n\n📊 ${pnl} | ${usd}\n\n${line}\n\nCA: 9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump\n🔮 ansem-oracle.xyz`;
}

function copyCard() {
  navigator.clipboard.writeText(getShareText()).then(() => showToast('Copied! Go flex on Twitter 🚀'));
}

function tweetCard() {
  const text = encodeURIComponent(getShareText());
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

function tgShare() {
  const text = encodeURIComponent(getShareText());
  window.open(`https://t.me/share/url?url=https://ansem-oracle.xyz&text=${text}`, '_blank');
}

// ── HELPERS ────────────────────────────────────────────────────────
function formatPrice(p) {
  if (p < 0.0001) return p.toExponential(2);
  if (p < 1) return p.toFixed(6);
  return p.toFixed(4);
}

function formatBig(n) {
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toFixed(0);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if(t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadLeaderboard();
});
