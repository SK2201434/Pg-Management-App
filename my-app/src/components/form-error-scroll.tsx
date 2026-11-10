import {
  createContext,
  type ComponentRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { ScrollView, Text, View, type HostInstance, type ScrollViewProps, type TextProps } from 'react-native';

// Scroll-to-error for forms. Submitting a long form with a mistake used to leave the screen on the
// Submit button while the message sat off-screen above. Now a field that starts showing an error
// registers itself with the nearest scroll container (`AppScrollView` or `ErrorScrollView`), and the
// container scrolls the topmost newly-errored field into view. Nothing else about a form has to
// change: fields only report that they have an error.
//
// - Only fields that just began showing an error are considered, so typing in a field that is
//   already visible never moves the screen, and an error that is already on screen is left alone.
// - Several errors appearing together (a failed submit) scroll to the first one on the page.

type ScrollViewNode = ComponentRef<typeof ScrollView>;

type ScrollLike = {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
  getInnerViewRef?: () => unknown;
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

type Registry = { add: (node: RefObject<HostInstance | null>, offset: number) => void; remove: (node: RefObject<HostInstance | null>) => void };

const ErrorScrollContext = createContext<Registry | null>(null);

/** Distance kept above the field when it is scrolled to. */
export const DEFAULT_ERROR_OFFSET = 24;
const SETTLE_MS = 60;

type Pending = { node: RefObject<HostInstance | null>; offset: number };

/** Provides scroll-to-error to every field inside it. `getScroll` returns the scroll container's ref. */
export function ErrorScrollProvider({ getScroll, children }: { getScroll: () => ScrollLike | null; children: ReactNode }) {
  const errored = useRef(new Set<RefObject<HostInstance | null>>());
  const fresh = useRef(new Map<RefObject<HostInstance | null>, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    timer.current = null;
    const pending: Pending[] = [...fresh.current].map(([node, offset]) => ({ node, offset }));
    fresh.current.clear();
    const targets = pending.filter((p) => p.node.current && errored.current.has(p.node));
    const scroll = getScroll();
    const content = scroll?.getInnerViewRef?.();
    if (!scroll || !content || targets.length === 0) return;

    // Where each field sits in the scrolled content; the topmost one wins.
    let best: { y: number; offset: number; node: HostInstance } | null = null;
    let waiting = targets.length;
    const done = () => {
      waiting -= 1;
      if (waiting > 0 || best === null) return;
      const { y, offset, node } = best;
      const target = Math.max(0, y - offset);
      // Leave it alone when the field is already fully on screen.
      const scrollBox = scroll.measureInWindow;
      if (!scrollBox) {
        scroll.scrollTo({ y: target, animated: true });
        return;
      }
      scrollBox.call(scroll, (_sx, sy, _sw, sh) => {
        node.measureInWindow((_x, wy, _w, h) => {
          const visible = wy >= sy && wy + h <= sy + sh;
          if (!visible) scroll.scrollTo({ y: target, animated: true });
        });
      });
    };
    for (const { node, offset } of targets) {
      const view = node.current;
      if (!view) {
        done();
        continue;
      }
      try {
        view.measureLayout(
          content as HostInstance,
          (_x, y) => {
            if (best === null || y < best.y) best = { y, offset, node: view };
            done();
          },
          done,
        );
      } catch {
        done();
      }
    }
  }, [getScroll]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const registry = useMemo<Registry>(
    () => ({
      add: (node, offset) => {
        if (!errored.current.has(node)) fresh.current.set(node, offset);
        errored.current.add(node);
        // Wait for the render that shows the errors to be laid out, then handle them together.
        if (timer.current === null) timer.current = setTimeout(flush, SETTLE_MS);
      },
      remove: (node) => {
        errored.current.delete(node);
        fresh.current.delete(node);
      },
    }),
    [flush],
  );

  return <ErrorScrollContext.Provider value={registry}>{children}</ErrorScrollContext.Provider>;
}

/**
 * Attach the returned ref to the view that wraps a field and its error. While `error` is set the
 * field takes part in scroll-to-error; outside a scroll container this does nothing.
 */
export function useScrollToError(error: unknown, offset: number = DEFAULT_ERROR_OFFSET): RefObject<HostInstance | null> {
  const registry = useContext(ErrorScrollContext);
  const ref = useRef<HostInstance | null>(null);
  const has = Boolean(error);
  useEffect(() => {
    if (!registry || !has) return;
    registry.add(ref, offset);
    return () => registry.remove(ref);
  }, [registry, has, offset]);
  return ref;
}

/** An inline error message that scrolls itself into view when it appears. Renders nothing when empty. */
export function ErrorText({ children, ...props }: TextProps) {
  // A little more room above than a field gets, so the control the message belongs to stays visible.
  const ref = useScrollToError(children, 96);
  if (!children) return null;
  return (
    <View ref={ref} collapsable={false}>
      <Text {...props}>{children}</Text>
    </View>
  );
}

/** A plain `ScrollView` with scroll-to-error, for forms in sheets and dialogs. */
export function ErrorScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<ScrollViewNode> }) {
  const inner = useRef<ScrollViewNode | null>(null);
  const setRef = useCallback(
    (node: ScrollViewNode | null) => {
      inner.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: ScrollViewNode | null }).current = node;
    },
    [ref],
  );
  const getScroll = useCallback(() => inner.current as unknown as ScrollLike | null, []);
  return (
    <ErrorScrollProvider getScroll={getScroll}>
      <ScrollView ref={setRef} {...props} />
    </ErrorScrollProvider>
  );
}
