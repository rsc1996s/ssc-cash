import { cloneElement, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export default function PageTransition({ children }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [transition, setTransition] = useState(null);
  const currentLocation = useRef(location);

  useLayoutEffect(() => {
    if (currentLocation.current.key === location.key) return;
    setTransition({
      from: currentLocation.current,
      to: location,
      direction: navigationType === "POP" ? "back" : "forward",
    });
    currentLocation.current = location;
  }, [location.key, navigationType]);

  if (transition) {
    const isBack = transition.direction === "back";
    const underneath = isBack ? transition.to : transition.from;
    const onTop = isBack ? transition.from : transition.to;
    return (
      <div
        className="relative min-h-screen overflow-x-hidden"
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setTransition(null);
        }}
      >
        <div className="min-h-screen">
          {cloneElement(children, { location: underneath, key: `under-${underneath.key}` })}
        </div>
        <div
          key={`top-${onTop.key}`}
          className={`absolute inset-0 z-10 min-h-screen ${
            isBack ? "page-transition page-transition-back" : "page-transition page-transition-forward"
          }`}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setTransition(null);
          }}
        >
          {cloneElement(children, { location: onTop, key: `top-routes-${onTop.key}` })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {cloneElement(children, { location, key: `routes-${location.key}` })}
    </div>
  );
}
