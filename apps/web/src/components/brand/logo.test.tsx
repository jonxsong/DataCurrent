import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "./logo";

describe("Logo", () => {
  it("exposes the brand to assistive technology", () => {
    render(<Logo />);
    expect(screen.getByLabelText("DataCurrent")).toHaveTextContent("DataCurrent");
  });

  it("keeps the accessible name in compact mode", () => {
    render(<Logo compact />);
    expect(screen.getByLabelText("DataCurrent")).toBeInTheDocument();
    expect(screen.queryByText("DataCurrent")).not.toBeInTheDocument();
  });
});
