"use client";

import { K, Cell, Header } from "../ui";

// Placeholder sheet. Intentionally empty until the cybersecurity features are scoped.
export default function SecurityClient() {
  return (
    <>
      <Header sheet="sheet 05 / cybersecurity" title="Cybersecurity" />
      <Cell label="cybersecurity" refId="A1">
        <div style={{ fontFamily: K.mono, fontSize: 12, color: K.mute, minHeight: 240 }}>empty</div>
      </Cell>
    </>
  );
}
