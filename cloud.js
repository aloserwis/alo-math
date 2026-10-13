let mathCloudUser = null;
let mathCloudReady = false;
let mathCloudBusy = false;
let mathCloudPaused = false;
let mathCloudSaveTimer = 0;
let mathCloudLastSync = '';
let mathCloudEmailDraft = '';
let mathCloudCodeDraft = '';
let mathCloudAuthMode = 'register';
let mathCloudAuthStep = 'credentials';
let mathCloudMessage = '';
let mathCloudLegacyPending = true;

function cloudEscape(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function cloudSafeState() {
  return {
    version: 1,
    selectedGrade: appState.selectedGrade,
    guideSeen: !!appState.guideSeen,
    profiles: appState.profiles
  };
}

function mergeCloudState(remote) {
  if (!remote || typeof remote !== 'object') return;
  const localProfiles = appState.profiles || {};
  const incomingProfiles = remote.profiles || {};
  for (const grade of ['2', '4']) {
    const local = localProfiles[grade] || freshProfile();
    const incoming = incomingProfiles[grade] || freshProfile();
    const results = { ...(local.results || {}) };
    for (const [id, result] of Object.entries(incoming.results || {})) {
      const old = results[id] || {};
      results[id] = {
        ...old, ...result,
        attempts: Math.max(Number(old.attempts) || 0, Number(result.attempts) || 0),
        errors: Math.max(Number(old.errors) || 0, Number(result.errors) || 0),
        mastered: !!(old.mastered || result.mastered),
        last: !old.last || String(result.last || '') > String(old.last) ? result.last : old.last
      };
    }
    const events = new Map();
    for (const event of [...(local.events || []), ...(incoming.events || [])]) {
      events.set([event.at, event.id, event.kind, event.ok, event.given].join('|'), event);
    }
    appState.profiles[grade] = {
      ...freshProfile(), ...local, ...incoming, results,
      events: [...events.values()].sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).slice(-2000),
      stars: Math.max(Number(local.stars) || 0, Number(incoming.stars) || 0),
      unlocked: Math.max(Number(local.unlocked) || 1, Number(incoming.unlocked) || 1),
      skipped: [...new Set([...(local.skipped || []), ...(incoming.skipped || [])])]
    };
  }
  appState.selectedGrade = remote.selectedGrade ? String(remote.selectedGrade) : appState.selectedGrade;
  appState.guideSeen = !!(appState.guideSeen || remote.guideSeen);
  if (!appState.profiles) appState.profiles = { '2': freshProfile(), '4': freshProfile() };
  for (const profile of Object.values(appState.profiles)) {
    if (!profile.results) profile.results = {};
    if (!Array.isArray(profile.events)) profile.events = [];
    if (!Array.isArray(profile.skipped)) profile.skipped = [];
  }
  selectedGrade = String(appState.selectedGrade || '4');
  state = appState.profiles[selectedGrade] || appState.profiles['4'];
  BANK = selectedGrade === '2' ? BANK2 : BANK4;
  LEVELS = selectedGrade === '2' ? LEVELS2 : LEVELS4;
}

async function mathCloudWrite() {
  if (!mathCloud || !mathCloudUser) return;
  const { error } = await mathCloud.from('math_adventure_state').upsert({
    user_id: mathCloudUser.id,
    state: cloudSafeState(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) throw error;
  mathCloudLastSync = new Date().toLocaleTimeString();
  renderCloudPanel();
}

async function mathCloudSync() {
  if (!mathCloud || !mathCloudUser || mathCloudBusy) return false;
  clearTimeout(mathCloudSaveTimer);
  mathCloudBusy = true;
  try {
    const { data, error } = await mathCloud.from('math_adventure_state')
      .select('state').eq('user_id', mathCloudUser.id).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      if (mathCloudLegacyPending) {
        const pin = appState.pin;
        appState = freshApp();
        appState.pin = pin;
      }
      mergeCloudState(data.state);
    }
    await mathCloudWrite();
    try { localStorage.removeItem(KEY); } catch {}
    mathCloudLegacyPending = false;
    mathCloudReady = true;
    mathCloudMessage = 'Đã kết nối và lưu tiến độ trên đám mây / Połączono i zapisano postępy w chmurze';
    return true;
  } catch (error) {
    mathCloudMessage = 'Không kết nối được dữ liệu: ' + (error.message || 'kiểm tra kết nối') + ' / Nie udało się połączyć danych';
    return false;
  } finally {
    mathCloudBusy = false;
    renderCloudPanel();
  }
}

function mathCloudQueue() {
  if (!mathCloudUser || !mathCloudReady || mathCloudPaused) return;
  clearTimeout(mathCloudSaveTimer);
  mathCloudSaveTimer = setTimeout(() => mathCloudWrite()
    .then(() => {
      mathCloudMessage = 'Đã lưu lên đám mây / Zapisano w chmurze';
      renderCloudPanel();
    })
    .catch(error => {
      mathCloudMessage = 'Chưa đồng bộ được: ' + (error.message || '') + ' / Nie zsynchronizowano';
      renderCloudPanel();
    }), 400);
}

const localSaveBeforeCloud = save;
save = function () {
  localSaveBeforeCloud();
  mathCloudQueue();
};

function renderAuthGate() {
  if (!app) return;
  document.getElementById('parentBtn').classList.add('hidden');
  document.getElementById('gradeBtn').classList.add('hidden');
  document.getElementById('subTitle').textContent = 'Tài khoản phụ huynh · Konto rodzica';
  app.className = 'view view-auth';
  const verify = mathCloudAuthStep === 'verify';
  app.innerHTML = `<section class="card hero"><h1>Math Adventure</h1><p>Utwórz konto rodzica lub zaloguj się${vn('Đăng ký tài khoản bố mẹ hoặc đăng nhập')}</p></section><section class="card pinCard"><h2>${verify ? 'Aktywuj konto / Kích hoạt tài khoản' : mathCloudAuthMode === 'register' ? 'Rejestracja rodzica / Đăng ký phụ huynh' : 'Logowanie rodzica / Đăng nhập phụ huynh'}</h2>${verify ? `<p>Wpisz 6-cyfrowy kod wysłany na <b>${cloudEscape(mathCloudEmailDraft)}</b>.${vn('Nhập mã 6 số được gửi tới email của bạn.')}</p><label for="mathCloudCode">Kod OTP / Mã kích hoạt</label><input id="mathCloudCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${cloudEscape(mathCloudCodeDraft)}" placeholder="123456" oninput="mathCloudCodeDraft=this.value" onkeydown="if(event.key==='Enter')mathCloudVerifySignup()"><div class="actions"><button onclick="mathCloudVerifySignup()" ${mathCloudBusy ? 'disabled' : ''}>Aktywuj konto / Kích hoạt tài khoản</button><button class="secondary" onclick="mathCloudAuthStep='credentials';mathCloudMessage='';renderAuthGate()" ${mathCloudBusy ? 'disabled' : ''}>Wróć / Quay lại</button></div>` : `<label for="mathCloudEmail">Email rodzica / Email phụ huynh</label><input id="mathCloudEmail" type="email" autocomplete="email" value="${cloudEscape(mathCloudEmailDraft)}" placeholder="name@example.com" oninput="mathCloudEmailDraft=this.value"><label for="mathCloudPassword">Hasło / Mật khẩu</label><input id="mathCloudPassword" type="password" autocomplete="${mathCloudAuthMode === 'register' ? 'new-password' : 'current-password'}" placeholder="${mathCloudAuthMode === 'register' ? 'Minimum 6 znaków / Tối thiểu 6 ký tự' : ''}" onkeydown="if(event.key==='Enter')mathCloudSubmitCredentials()"><div class="actions"><button onclick="mathCloudSubmitCredentials()" ${mathCloudBusy ? 'disabled' : ''}>${mathCloudAuthMode === 'register' ? 'Utwórz konto / Đăng ký' : 'Zaloguj się / Đăng nhập'}</button><button class="secondary" onclick="mathCloudAuthMode='${mathCloudAuthMode === 'register' ? 'login' : 'register'}';mathCloudMessage='';renderAuthGate()" ${mathCloudBusy ? 'disabled' : ''}>${mathCloudAuthMode === 'register' ? 'Mam już konto / Đã có tài khoản' : 'Utwórz konto / Đăng ký nowe'}</button></div>`}${mathCloudUser && !mathCloudReady ? `<div class="actions"><button class="secondary" onclick="mathCloudFinishAuth(mathCloudUser)" ${mathCloudBusy ? 'disabled' : ''}>Ponów połączenie / Thử kết nối lại</button></div>` : ''}<p class="note">${cloudEscape(mathCloudMessage)}${mathCloudBusy ? ' · Łączenie… / Đang kết nối…' : ''}</p></section>`;
}

async function mathCloudSubmitCredentials() {
  const requestedMode = mathCloudAuthMode;
  const email = document.getElementById('mathCloudEmail')?.value.trim();
  const password = document.getElementById('mathCloudPassword')?.value || '';
  mathCloudEmailDraft = email || '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    mathCloudMessage = 'Wpisz prawidłowy e-mail / Hãy nhập email hợp lệ';
    renderAuthGate();
    return;
  }
  if (!password || (requestedMode === 'register' && password.length < 6)) {
    mathCloudMessage = requestedMode === 'register' ? 'Hasło musi mieć co najmniej 6 znaków / Mật khẩu cần ít nhất 6 ký tự' : 'Wpisz hasło / Hãy nhập mật khẩu';
    renderAuthGate();
    return;
  }
  if (!mathCloud) {
    mathCloudMessage = 'Usługa logowania jest niedostępna / Dịch vụ đăng nhập chưa sẵn sàng';
    renderAuthGate();
    return;
  }
  mathCloudBusy = true;
  mathCloudMessage = '';
  renderAuthGate();
  const result = requestedMode === 'register'
    ? await mathCloud.auth.signUp({ email, password })
    : await mathCloud.auth.signInWithPassword({ email, password });
  mathCloudBusy = false;
  if (result.error) {
    mathCloudMessage = result.error.message;
    renderAuthGate();
    return;
  }
  if (requestedMode === 'register' && !result.data.session) {
    mathCloudAuthStep = 'verify';
    mathCloudMessage = 'Wysłaliśmy kod aktywacyjny / Đã gửi mã kích hoạt tới email';
    renderAuthGate();
    return;
  }
  await mathCloudFinishAuth(result.data.user || result.data.session?.user);
}

async function mathCloudVerifySignup() {
  const token = document.getElementById('mathCloudCode')?.value.replace(/\s/g, '');
  mathCloudCodeDraft = token || '';
  if (!/^[0-9]{6}$/.test(token || '')) {
    mathCloudMessage = 'Wpisz 6-cyfrowy kod / Hãy nhập mã gồm 6 chữ số';
    renderAuthGate();
    return;
  }
  mathCloudBusy = true;
  renderAuthGate();
  const { data, error } = await mathCloud.auth.verifyOtp({ email: mathCloudEmailDraft, token, type: 'signup' });
  mathCloudBusy = false;
  if (error) {
    mathCloudMessage = error.message;
    renderAuthGate();
    return;
  }
  mathCloudCodeDraft = '';
  await mathCloudFinishAuth(data.user);
}

async function mathCloudFinishAuth(user) {
  if (!user) {
    mathCloudMessage = 'Nie udało się potwierdzić konta / Không xác nhận được tài khoản';
    renderAuthGate();
    return;
  }
  mathCloudUser = user;
  mathCloudReady = false;
  const ok = await mathCloudSync();
  if (!ok) {
    mathCloudReady = false;
    renderAuthGate();
    return;
  }
  mathCloudAuthStep = 'credentials';
  mathCloudAuthMode = 'login';
  mode = 'child';
  if (!appState.pin) view = 'setup';
  else if (!appState.selectedGrade) view = 'unlock';
  else view = 'home';
  render();
}

async function mathCloudSignOut() {
  if (!mathCloud) return;
  await mathCloud.auth.signOut();
  mathCloudUser = null;
  mathCloudReady = false;
  mathCloudLegacyPending = false;
  appState = freshApp();
  try { localStorage.removeItem(PIN_KEY); localStorage.removeItem(KEY); } catch {}
  mathCloudMessage = 'Wylogowano / Đã đăng xuất';
  renderAuthGate();
}

function renderCloudPanel() {
  const box = document.getElementById('mathCloudPanel');
  if (!box) return;
  box.innerHTML = `<div class="card" style="margin-top:18px"><h3>☁️ Konto i synchronizacja rodzica / Tài khoản và đồng bộ</h3>${vn('Kết quả học được lưu trên tài khoản để bố mẹ xem trên thiết bị khác. PIN bố mẹ chỉ lưu trên thiết bị này.')}${mathCloudUser ? `<p><b>Konto / Tài khoản:</b> ${cloudEscape(mathCloudUser.email || '')}</p><p class="muted">${cloudEscape(mathCloudMessage)}${mathCloudLastSync ? ' · ' + cloudEscape(mathCloudLastSync) : ''}</p>` : ''}<div class="actions"><button class="secondary" onclick="mathCloudSync()" ${mathCloudBusy ? 'disabled' : ''}>↻ Synchronizuj teraz / Đồng bộ ngay</button><button class="outline" onclick="mathCloudSignOut()">Wyloguj / Đăng xuất tài khoản</button></div></div>`;
}

const renderParentPanelBeforeCloud = parent;
parent = function () {
  renderParentPanelBeforeCloud();
  if (mode !== 'parent' || !mathCloudReady) return;
  const card = app.querySelector('.card');
  if (!card) return;
  const cloud = document.createElement('section');
  cloud.id = 'mathCloudPanel';
  card.appendChild(cloud);
  renderCloudPanel();
};

const renderAppAfterCloudAuth = render;
render = function () {
  if (!mathCloudReady || !mathCloudUser) {
    renderAuthGate();
    return;
  }
  renderAppAfterCloudAuth();
};

async function initMathCloud() {
  if (!mathCloud) {
    mathCloudMessage = 'Nie można załadować logowania. Sprawdź połączenie internetowe. / Không tải được dịch vụ đăng nhập. Hãy kiểm tra mạng.';
    renderAuthGate();
    return;
  }
  const { data, error } = await mathCloud.auth.getSession();
  if (error) mathCloudMessage = error.message;
  mathCloud.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      mathCloudUser = null;
      mathCloudReady = false;
      renderAuthGate();
    }
  });
  if (data.session?.user) {
    await mathCloudFinishAuth(data.session.user);
  } else {
    renderAuthGate();
  }
}

window.addEventListener('focus', () => { if (mathCloudUser && mathCloudReady) void mathCloudSync(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && mathCloudUser && mathCloudReady) void mathCloudSync();
});
renderAuthGate();
void initMathCloud();
