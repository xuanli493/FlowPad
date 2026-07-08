/**
 * FlowPad SPA 入口 - 侧边栏 + 路由
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

    // 恢复上次状态
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') setCollapsed(true);

    toggle.addEventListener('click', () => {
        setCollapsed(!sidebar.classList.contains('collapsed'));
    });

    // ====== 路由注册 ======
    Router.register('/',          (el) => Dashboard(el));
    Router.register('/calibrate', (el) => Calibrate(el));
    Router.register('/settings',  (el) => Settings(el));
    Router.register('/wifi',      (el) => Wifi(el));
})();
