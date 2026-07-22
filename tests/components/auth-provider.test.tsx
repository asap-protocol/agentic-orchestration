// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Session } from "next-auth"
import { AuthProvider } from "@/components/auth-provider"

const sessionProvider = vi.fn(
  ({ children }: { children: React.ReactNode; session?: Session }) => (
    <div data-testid="session-provider">{children}</div>
  ),
)

vi.mock("next-auth/react", () => ({
  SessionProvider: (props: { children: React.ReactNode; session?: Session }) =>
    sessionProvider(props),
}))

describe("AuthProvider", () => {
  it("passes SSR session into SessionProvider for client hydration", () => {
    const session = {
      user: { name: "Ada", email: "ada@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } satisfies Session

    render(
      <AuthProvider session={session}>
        <span>child</span>
      </AuthProvider>,
    )

    expect(screen.getByText("child")).toBeInTheDocument()
    expect(sessionProvider).toHaveBeenCalled()
    const props = sessionProvider.mock.calls[0]?.[0] as {
      session?: Session
    }
    expect(props.session).toEqual(session)
  })

  it("maps null session to undefined so SessionProvider stays unauthenticated", () => {
    render(
      <AuthProvider session={null}>
        <span>anon</span>
      </AuthProvider>,
    )

    expect(screen.getByText("anon")).toBeInTheDocument()
    const props = sessionProvider.mock.calls.at(-1)?.[0] as {
      session?: Session
    }
    expect(props.session).toBeUndefined()
  })
})
