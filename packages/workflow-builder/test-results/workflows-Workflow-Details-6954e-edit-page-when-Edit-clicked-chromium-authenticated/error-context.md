# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - heading "Sign In" [level=1] [ref=e8]
      - generic [ref=e9]: Welcome back to Workflow Builder
    - generic [ref=e10]:
      - generic [ref=e11]: Email
      - textbox "you@example.com" [ref=e14]
    - generic [ref=e15]:
      - generic [ref=e16]: Password
      - textbox "••••••••" [ref=e19]
    - generic [ref=e20]:
      - button "Sign In" [disabled]:
        - generic: Sign In
    - generic [ref=e21]:
      - generic [ref=e22]: Don't have an account?
      - link "Sign Up" [ref=e23] [cursor=pointer]:
        - /url: /auth/signup
  - alert [ref=e24]
```