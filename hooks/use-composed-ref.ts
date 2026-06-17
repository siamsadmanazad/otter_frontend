"use client"
import * as React from "react";

/**
 * A utility hook that composes multiple React refs into a single ref.
 * This is useful when a component needs to expose a ref to its parent,
 * but also needs to hold its own internal ref to the same DOM element.
 *
 * @param {Array<React.Ref<T>>} refs - An array of refs to compose.
 * @returns {React.RefCallback<T>} A single ref callback that updates all the provided refs.
 */
export function useComposedRef<T>(
  ...refs: Array<React.Ref<T> | null>
): React.RefCallback<T> {
  return React.useCallback(
    (node: T) => {
      // Iterate over each ref and update it.
      for (const ref of refs) {
        if (typeof ref === "function") {
          // If the ref is a function, call it with the node.
          ref(node);
        } else if (ref != null) {
          // If the ref is an object, update its `current` property.
          (ref as React.MutableRefObject<T | null>).current = node;
        }
      }
    },
    [...refs]
  );
}
