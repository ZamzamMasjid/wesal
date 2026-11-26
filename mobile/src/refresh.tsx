import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

// Pull-to-refresh (docs/features/customer-mobile-app/design.md). The app shell
// owns the scroll view that the gesture fires on, while each screen owns its
// data. A screen registers the reload it can perform; the shell awaits it so the
// native spinner stays visible until the new state is on screen.

export type RefreshHandler = () => Promise<void> | void;

type Register = (handler: RefreshHandler) => () => void;

const RefreshContext = createContext<Register>(() => () => undefined);

export function RefreshProvider({
  register,
  children,
}: {
  register: Register;
  children: ReactNode;
}) {
  return (
    <RefreshContext.Provider value={register}>
      {children}
    </RefreshContext.Provider>
  );
}

/**
 * Registers the active screen's refresh work. The handler is kept in a ref so a
 * screen may pass an inline closure without re-registering on every render.
 */
export function useRefreshHandler(handler: RefreshHandler) {
  const register = useContext(RefreshContext);
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => register(() => latest.current()), [register]);
}
