/**
 * FlowPad Hash Router - 侧边栏版
 */
const Router = (() => {
    const routes = {};
    let currentView = null;

    function register(hash, handler) {
        routes[hash] = handler;
    }

    function navigate() {
        const hash = location.hash.slice(1) || '/';

        // 更新侧边栏高亮
        document.querySelectorAll('.sidebar-item').forEach(a => {
            a.classList.toggle('active', a.getAttribute('data-page') === hash);
        });

        // 渲染页面
        const handler = routes[hash] || routes['/'];
        if (handler) {
            if (currentView && currentView.destroy) currentView.destroy();
            document.getElementById('app').innerHTML = '';
            currentView = handler(document.getElementById('app'));
        }
    }

    window.addEventListener('hashchange', navigate);
    window.addEventListener('DOMContentLoaded', navigate);

    return { register, navigate };
})();
