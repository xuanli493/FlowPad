/**
 * FlowPad SPA 入口 - 侧边栏 + OOBE + 路由
 */
(function() {
    // ====== 侧边栏收起/展开 ======
    const sidebar  = document.getElementById('sidebar');
    const toggle   = document.getElementById('sidebarToggle');
    const STORAGE_KEY = 'flowpad_sidebar_collapsed';

    function setCollapsed(collapsed) {
        if (collapsed) {
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed-app');
        } else {
            sidebar.classList.remove('collapsed');
            document.body.classList.remove('sidebar-collapsed-app');
        }
        localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') setCollapsed(true);

    toggle.addEventListener('click', () => {
        setCollapsed(!sidebar.classList.contains('collapsed'));
    });

    // ====== OOBE 检测: AP 模式强制配网页 ======
    let inOOBE = false;

    function enterOOBE() {
        inOOBE = true;
        document.body.classList.add('oobe-mode');
        sidebar.style.display = 'none';
        location.hash = '#/wifi';
        // 锁定 hash 为 /wifi
        window.addEventListener('hashchange', _oobeGuard);
    }

    function _oobeGuard() {
        if (inOOBE && location.hash !== '#/wifi') {
            location.hash = '#/wifi';
        }
    }

    // 启动时检测
    fetch('/api/wifi/status')
        .then(r => r.json())
        .then(status => {
            if (status.apMode) {
                enterOOBE();
            }
        })
        .catch(() => {});  // API 不可用时走正常路由

    // ====== 路由注册 ======
    Router.register('/',          (el) => Dashboard(el));
    Router.register('/calibrate', (el) => Calibrate(el));
    Router.register('/settings',  (el) => Settings(el));
    Router.register('/wifi',      (el) => Wifi(el));
})();
