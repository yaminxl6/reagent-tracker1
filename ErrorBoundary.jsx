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
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#FBEAE6", padding: 20, fontFamily: "monospace", color: "#8A2E1F" }}>
          <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>The app crashed. Please screenshot this and send it to Claude:</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #C1432B" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
