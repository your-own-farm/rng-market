// Dynamic import ensures Module Federation shared modules are initialised
// before any app code runs (the "eager chunk" pattern).
import("./bootstrap");
