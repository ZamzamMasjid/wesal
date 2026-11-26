// SPEC: customer-mobile-app/spec.md — the app uses logical layout helpers so the
// same screens mirror in Arabic, with touch targets of at least 48dp.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Scaffold Expo app with
// Arabic/English and RTL, consuming /api/v1

import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActivityIndicator, Text } from "react-native";

import {
  Banner,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Screen,
  Title,
  align,
  direction,
  styles,
} from "./components";
import { fontFamilyFor } from "./fonts";
import { colors } from "./theme";

describe("layout helpers", () => {
  it("maps the locale to a direction, a row order and text alignment", () => {
    expect(direction("ar")).toBe("rtl");
    expect(direction("en")).toBe("ltr");
    expect(styles.row).toEqual({ flexDirection: "row" });
    expect(align("ar")).toEqual({ textAlign: "right" });
    expect(align("en")).toEqual({ textAlign: "left" });
  });
});

describe("fonts", () => {
  it("picks the Cairo face that matches the weight", () => {
    expect(fontFamilyFor(undefined)).toBe("Cairo_400Regular");
    expect(fontFamilyFor("normal")).toBe("Cairo_400Regular");
    expect(fontFamilyFor("500")).toBe("Cairo_500Medium");
    expect(fontFamilyFor(600)).toBe("Cairo_600SemiBold");
    expect(fontFamilyFor("bold")).toBe("Cairo_700Bold");
    expect(fontFamilyFor("800")).toBe("Cairo_800ExtraBold");
  });
});

describe("Screen", () => {
  it("renders children and the footer", () => {
    render(
      <Screen locale="en" footer={<Text>footer</Text>}>
        <Text>content</Text>
      </Screen>,
    );

    expect(screen.getByText("content")).toBeOnTheScreen();
    expect(screen.getByText("footer")).toBeOnTheScreen();
  });
});

describe("text primitives", () => {
  it("mirrors Title, Heading and Body for Arabic", () => {
    render(
      <>
        <Title locale="ar">title</Title>
        <Heading locale="ar">heading</Heading>
        <Body locale="ar">body</Body>
        <Body locale="ar" muted>
          muted
        </Body>
      </>,
    );

    expect(screen.getByText("title")).toHaveStyle({
      textAlign: "right",
      fontFamily: "Cairo_700Bold",
    });
    expect(screen.getByText("heading")).toHaveStyle({
      textAlign: "right",
      fontFamily: "Cairo_700Bold",
    });
    expect(screen.getByText("body")).toHaveStyle({
      textAlign: "right",
      fontFamily: "Cairo_400Regular",
    });
    expect(screen.getByText("muted")).toHaveStyle({ color: colors.muted });
  });

  it("aligns English text to the left", () => {
    render(<Body locale="en">body</Body>);

    expect(screen.getByText("body")).toHaveStyle({ textAlign: "left" });
  });
});

describe("Button", () => {
  it("calls onPress and exposes its label to assistive tech", () => {
    const onPress = jest.fn();
    render(<Button locale="en" label="Check availability" onPress={onPress} />);

    fireEvent.press(screen.getByRole("button", { name: "Check availability" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Check availability")).toBeOnTheScreen();
  });

  it("renders each variant", () => {
    render(
      <>
        <Button locale="en" label="primary" onPress={jest.fn()} />
        <Button
          locale="en"
          variant="secondary"
          label="secondary"
          onPress={jest.fn()}
        />
        <Button locale="en" variant="ghost" label="ghost" onPress={jest.fn()} />
        <Button
          locale="en"
          variant="danger"
          label="danger"
          onPress={jest.fn()}
        />
      </>,
    );

    for (const label of ["primary", "secondary", "ghost", "danger"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it("shows a spinner and hides the label while busy", () => {
    const onPress = jest.fn();
    render(<Button locale="en" label="Send code" busy onPress={onPress} />);

    expect(screen.queryByText("Send code")).not.toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it("does not call onPress while disabled", () => {
    const onPress = jest.fn();
    render(<Button locale="en" label="Send code" disabled onPress={onPress} />);

    fireEvent.press(screen.getByRole("button", { name: "Send code" }));

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("Field", () => {
  it("labels the input and forwards edits", () => {
    const onChangeText = jest.fn();
    render(
      <Field
        locale="ar"
        label="الهاتف"
        value=""
        onChangeText={onChangeText}
        keyboardType="phone-pad"
        secure
        placeholder="01xxxxxxxxx"
      />,
    );

    const input = screen.getByLabelText("الهاتف");
    expect(input).toHaveProp("keyboardType", "phone-pad");
    expect(input).toHaveProp("secureTextEntry", true);
    expect(input).toHaveProp("placeholder", "01xxxxxxxxx");
    expect(input).toHaveStyle({ textAlign: "right", writingDirection: "rtl" });

    fireEvent.changeText(input, "01000000000");
    expect(onChangeText).toHaveBeenCalledWith("01000000000");
  });
});

describe("Banner", () => {
  it("renders each tone", () => {
    render(
      <>
        <Banner locale="en" message="info" />
        <Banner locale="en" tone="error" message="error" />
        <Banner locale="en" tone="success" message="success" />
      </>,
    );

    expect(screen.getByText("info")).toHaveStyle({ color: colors.fg });
    expect(screen.getByText("error")).toHaveStyle({ color: colors.danger });
    expect(screen.getByText("success")).toHaveStyle({ color: colors.success });
  });
});

describe("Card", () => {
  it("renders its children", () => {
    render(
      <Card>
        <Text>inside</Text>
      </Card>,
    );

    expect(screen.getByText("inside")).toBeOnTheScreen();
  });
});
