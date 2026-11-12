import { useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const MAIN_MENU_PATHS = new Set([
  "/",
  "/transfers",
  "/owner",
  "/admin/funds",
  "/reports",
  "/daily-closings",
  "/settings",
]);

const NO_ANIMATION_PATHS = new Set(["/login", "/register", "/pending"]);

function getRouteDepth(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (NO_ANIMATION_PATHS.has(path)) return null;
  if (MAIN_MENU_PATHS.has(path)) return 0;
  if (
    path === "/new" ||
    path === "/change-pin" ||
    /^\/settings\/(users|categories|bank-accounts|activity)$/.test(path) ||
    path === "/transfers/withdrawals/new" ||
    path === "/transfers/payments/new" ||
    /^\/transaction\/[^/]+$/.test(path)
  ) {
    return 1;
  }
  if (
    /^\/transaction\/[^/]+\/print$/.test(path) ||
    /^\/transfers\/withdrawals\/[^/]+(?:\/print)?$/.test(path) ||
    /^\/transfers\/payments\/[^/]+(?:\/print)?$/.test(path)
  ) {
    return 2;
  }

  return null;
}

export default function PageTransition({ children }) {
  const location = useLocation();
  const [transition, setTransition] = useState(null);
  const currentLocation = useRef(location);
  const timeout = useRef(null);

  useLayoutEffect(() => {
    if (currentLocation.current.key === location.key) return;

    const previousDepth = getRouteDepth(currentLocation.current.pathname);
    const nextDepth = getRouteDepth(location.pathname);
    currentLocation.current = location;

    window.scrollTo(0, 0);
    window.clearTimeout(timeout.current);

    if (previousDepth === null || nextDepth === null || previousDepth === nextDepth) {
      setTransition(null);
      return;
    }

    const direction = nextDepth > previousDepth ? "forward" : "back";
    setTransition({ key: location.key, direction });
    timeout.current = window.setTimeout(() => setTransition(null), 300);
  }, [location.key, location.pathname]);

  useLayoutEffect(() => () => window.clearTimeout(timeout.current), []);

  const animationClass =
    transition?.key === location.key
      ? `page-transition page-transition-${transition.direction}`
      : "";

  return (
    <div
      key={location.key}
      className={`min-h-screen ${animationClass}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          window.clearTimeout(timeout.current);
          setTransition(null);
        }
      }}
    >
      {children}
    </div>
  );
}
