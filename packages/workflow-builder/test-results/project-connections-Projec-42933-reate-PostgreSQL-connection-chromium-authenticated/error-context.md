# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e7]:
    - generic [ref=e8]:
      - heading "Sign In" [level=1] [ref=e9]
      - generic [ref=e10]: Welcome back to Workflow Builder
    - generic [ref=e11]:
      - generic [ref=e12]: Email
      - textbox "you@example.com" [ref=e15]
    - generic [ref=e16]:
      - generic [ref=e17]: Password
      - textbox "••••••••" [ref=e20]
    - generic [ref=e21]:
      - button "Sign In" [disabled]:
        - generic: Sign In
    - generic [ref=e22]:
      - generic [ref=e23]: Don't have an account?
      - link "Sign Up" [ref=e24] [cursor=pointer]:
        - /url: /auth/signup
  - alert [ref=e25]
```