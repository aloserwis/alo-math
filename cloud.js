let mathCloudUser = null;
let mathCloudMessage = 'Chưa kết nối tài khoản / Konto niepołączone';
let mathCloudBusy = false;
let mathCloudPaused = false;
let mathCloudSaveTimer = 0;
let mathCloudLastSync = '';
let mathCloudEmailDraft = '';
let mathCloudCodeDraft = '';

function cloudEscape(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function cloudMessage(text, isError = false) {
  mathCloudMessage = (isError ? '⚠️ ' : '✓ ') + text;
  renderCloudPanel();
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
  const local = appState.profiles || {};
  const incoming = remote.profiles || {};
  for (const grade of ['2', '4']) {
    const a = local[grade] || freshProfile();
    const b = incoming[grade] || freshProfile();
    const results = { ...(a.results || {}) };
    for (const [id, result] of Object.entries(b.results || {})) {
      const old = results[id] || {};
      results[id] = {
        ...old,
        ...result,
        attempts: Math.max(Number(old.attempts) || 0, Number(result.attempts) || 0),
        errors: Math.max(Number(old.errors) || 0, Number(result.errors) || 0),
        mastered: !!(old.mastered || result.mastered),
        last: !old.last || String(result.last || '') > String(old.last) ? result.last : old.last
      };
    }
    const events = new Map();
    for (const event of [...(a.events || []), ...(b.events || [])]) {
      const key = [event.at, event.id, event.kind, event.ok, event.given].join('|');
      events.set(key, event);
    }
    const mergedEvents = [...events.values()]
      .sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')))
      .slice(-2000);
    local[grade] = {
      ...freshProfile(), ...a, ...b, results, events: mergedEvents,
      stars: Math.max(Number(a.stars) || 0, Number(b.stars) || 0),
      unlocked: Math.max(Number(a.unlocked) || 1, Number(b.unlocked) || 1),
      skipped: [...new Set([...(a.skipped || []), ...(b.skipped || [])])]
    };
  }
  appState.profiles = local;
  if (!appState.selectedGrade && remote.selectedGrade) appState.selectedGrade = String(remote.selectedGrade);
  appState.guideSeen = !!(appState.guideSeen || remote.guideSeen);
  selectedGrade = String(appState.selectedGrade || selectedGrade);
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
  if (!mathCloud || !mathCloudUser || mathCloudBusy) return;
  mathCloudBusy = true;
  renderCloudPanel();
  try {
    const { data, error } = await mathCloud.from('math_adventure_state')
      .select('state').eq('user_id', mathCloudUser.id).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      mergeCloudState(data.state);
      mathCloudPaused = true;
      try { localStorage.setItem(KEY, JSON.stringify(appState)); }
      finally { mathCloudPaused = false; }
    }
    await mathCloudWrite();
    mathCloudMessage = 'Đã đồng bộ / Zsynchronizowano';
    if (view === 'parent' && mode === 'parent') render();
    else renderCloudPanel();
  } catch (error) {
    mathCloudMessage = 'Không đồng bộ được: ' + (error.message || 'kiểm tra kết nối') + ' / Synchronizacja nieudana';
    renderCloudPanel();
  } finally {
    mathCloudBusy = false;
    renderCloudPanel();
  }
}

function mathCloudQueue() {
  if (!mathCloudUser || mathCloudPaused) return;
  clearTimeout(mathCloudSaveTimer);
  mathCloudSaveTimer = setTimeout(() => mathCloudWrite()
    .then(() => {
      mathCloudMessage = 'Đã lưu lên đám mây / Zapisano w chmurze';
      renderCloudPanel();
    })
    .catch(error => {
      mathCloudMessage = 'Chưa đồng bộ được: ' + (error.message || '') + ' / Nie zsynchronizowano';
      renderCloudPanel();
    }), 500);
}

const localSaveBeforeCloud = save;
save = function () {
  localSaveBeforeCloud();
  mathCloudQueue();
};

async function mathCloudSendCode() {
  const email = document.getElementById('mathCloudEmail')?.value.trim();
  mathCloudEmailDraft = email || '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    cloudMessage('Nhập email hợp lệ / Wpisz prawidłowy e-mail', true);
    return;
  }
  if (!mathCloud) {
    cloudMessage('Không tải được dịch vụ kết nối / Nie załadowano biblioteki', true);
    return;
  }
  mathCloudBusy = true;
  renderCloudPanel();
  const { error } = await mathCloud.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname }
  });
  mathCloudBusy = false;
  if (error) {
    cloudMessage('Không gửi được mã: ' + error.message + ' / Nie wysłano kodu', true);
    return;
  }
  cloudMessage('Đã gửi mã 6 số tới email. Mã có thời hạn theo cấu hình Supabase. / Wysłano 6-cyfrowy kod e-mail.');
  document.getElementById('mathCloudCode')?.focus();
}

async function mathCloudVerifyCode() {
  const email = document.getElementById('mathCloudEmail')?.value.trim();
  const token = document.getElementById('mathCloudCode')?.value.replace(/\s/g, '');
  mathCloudEmailDraft = email || '';
  mathCloudCodeDraft = token || '';
  if (!email || !/^[0-9]{6}$/.test(token || '')) {
    cloudMessage('Nhập email và mã OTP 6 số / Wpisz e-mail i 6-cyfrowy kod', true);
    return;
  }
  mathCloudBusy = true;
  renderCloudPanel();
  const { data, error } = await mathCloud.auth.verifyOtp({ email, token, type: 'email' });
  mathCloudBusy = false;
  if (error) {
    cloudMessage('Mã không hợp lệ hoặc đã hết hạn. Gửi mã mới và thử lại. / Kod jest nieprawidłowy lub wygasł.', true);
    return;
  }
  mathCloudUser = data.user;
  mathCloudCodeDraft = '';
  await mathCloudSync();
}

async function mathCloudSignOut() {
  if (!mathCloud) return;
  await mathCloud.auth.signOut();
  mathCloudUser = null;
  mathCloudMessage = 'Đã đăng xuất khỏi đồng bộ / Wylogowano';
  renderCloudPanel();
}

function renderCloudPanel() {
  const box = document.getElementById('mathCloudPanel');
  if (!box) return;
  box.innerHTML = `<div class="card" style="margin-top:18px"><h3>☁️ Đồng bộ kết quả giữa các thiết bị</h3>${vn('Bố mẹ dùng email để nhận mã OTP 6 số. Đăng nhập cùng email trên iPhone khác để xem kết quả lớp 2 và lớp 4.')}${mathCloudUser ? `<p><b>Đã kết nối / Połączono:</b> ${cloudEscape(mathCloudUser.email || '')}</p><p class="muted">PIN bố mẹ chỉ lưu trên thiết bị này. / PIN rodzica jest przechowywany tylko na tym urządzeniu.</p>` : `<label for="mathCloudEmail">Email bố mẹ / E-mail rodzica</label><input id="mathCloudEmail" type="email" autocomplete="email" value="${cloudEscape(mathCloudEmailDraft)}" oninput="mathCloudEmailDraft=this.value" placeholder="name@example.com"><div class="actions"><button class="secondary" onclick="mathCloudSendCode()" ${mathCloudBusy ? 'disabled' : ''}>Gửi mã OTP / Wyślij kod</button></div><label for="mathCloudCode">Mã OTP 6 số / Kod OTP (6 cyfr)</label><input id="mathCloudCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${cloudEscape(mathCloudCodeDraft)}" oninput="mathCloudCodeDraft=this.value" placeholder="123456"><div class="actions"><button onclick="mathCloudVerifyCode()" ${mathCloudBusy ? 'disabled' : ''}>Xác minh và đồng bộ / Zweryfikuj i synchronizuj</button></div>`}<p class="note">${cloudEscape(mathCloudMessage)}${mathCloudLastSync ? ' · ' + cloudEscape(mathCloudLastSync) : ''}</p>${mathCloudUser ? `<div class="actions"><button class="secondary" onclick="mathCloudSync()" ${mathCloudBusy ? 'disabled' : ''}>↻ Đồng bộ ngay / Synchronizuj teraz</button><button class="outline" onclick="mathCloudSignOut()">Đăng xuất / Wyloguj</button></div>` : ''}</div>`;
}

const parentWithSettingsAndCloud = parent;
parent = function () {
  parentWithSettingsAndCloud();
  if (mode !== 'parent') return;
  const card = app.querySelector('.card');
  if (!card) return;
  const cloud = document.createElement('section');
  cloud.id = 'mathCloudPanel';
  card.appendChild(cloud);
  renderCloudPanel();
};

async function initMathCloud() {
  if (!mathCloud) {
    mathCloudMessage = 'Không tải được thư viện Supabase; chức năng đồng bộ đang tắt. / Nie załadowano biblioteki Supabase.';
    return;
  }
  const { data } = await mathCloud.auth.getSession();
  mathCloudUser = data.session?.user || null;
  mathCloud.auth.onAuthStateChange((_event, session) => {
    mathCloudUser = session?.user || null;
    setTimeout(() => {
      if (mathCloudUser) void mathCloudSync();
      else renderCloudPanel();
    }, 0);
  });
  if (mathCloudUser) await mathCloudSync();
}

window.addEventListener('focus', () => { if (mathCloudUser) void mathCloudSync(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && mathCloudUser) void mathCloudSync();
});
void initMathCloud();
