/** The page's path, kept in step with the address bar and its back and forward buttons. */
class Router {
  path = $state(location.pathname);
}

export const router = new Router();

window.addEventListener("popstate", () => {
  router.path = location.pathname;
});

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (options.replace) history.replaceState(null, "", path);
  else if (path !== location.pathname) history.pushState(null, "", path);
  router.path = path;
}
