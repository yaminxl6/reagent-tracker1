import React from "react";

// Shows the actual error on screen instead of a blank white page, so it
// can be read/screenshotted without needing browser dev tools.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
    this.setState({ componentStack: info?.componentStack });
  }
  render() {
    if (this.state.error) {
      // Not everything thrown is a real Error — a rejected promise, a
      // third-party library, or a DOM API can throw a string, a plain
      // object, or an Error with no message/stack, which left this box
      // blank before with nothing to screenshot.
      const err = this.state.error;
      let details;
      try {
        details = err instanceof Error
          ? `${err.name || "Error"}: ${err.message || "(no message)"}\n\n${err.stack || "(no stack trace)"}`
          : `Non-Error value thrown:\n${JSON.stringify(err, null, 2)}`;
      } catch {
        details = `Non-Error value thrown (could not stringify): ${String(err)}`;
      }
      if (this.state.componentStack) details += `\n\nComponent stack:${this.state.componentStack}`;

      return (
        <div style={{ minHeight: "100vh", background: "#FBEAE6", padding: 20, fontFamily: "monospace", color: "#8A2E1F" }}>
          <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>The app crashed. Please screenshot this and send it to Claude:</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #C1432B" }}>
            {details}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
