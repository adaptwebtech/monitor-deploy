import { onMounted, onBeforeUnmount } from "vue";
import type { Ref } from "vue";

export function useInfiniteScroll(
  target: Ref<HTMLElement | null>,
  onReached: () => void,
): void {
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onReached();
        }
      },
      { rootMargin: "0px 0px 300px 0px" },
    );

    if (target.value) {
      observer.observe(target.value);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });
}
