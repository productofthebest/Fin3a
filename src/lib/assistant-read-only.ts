// The model receives text and aggregates, never executable account/Admin tools.
export function readOnlyAssistantOptions<T extends object>(options: T): Omit<T, "tools" | "toolChoice"> & { tools: undefined; toolChoice: "none" } {
  return { ...options, tools: undefined, toolChoice: "none" };
}