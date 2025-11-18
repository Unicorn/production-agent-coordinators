# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - heading "Sign In" [level=1] [ref=e8]
      - generic [ref=e9]: Welcome back to Workflow Builder
    - generic [ref=e11]: Invalid login credentials
    - generic [ref=e12]:
      - generic [ref=e13]: Email
      - textbox "you@example.com" [ref=e16]: testuser@example.com
    - generic [ref=e17]:
      - generic [ref=e18]: Password
      - textbox "••••••••" [ref=e21]: testpassword123
    - button "Sign In" [ref=e23] [cursor=pointer]:
      - generic [ref=e24]: Sign In
    - generic [ref=e25]:
      - generic [ref=e26]: Don't have an account?
      - link "Sign Up" [ref=e27] [cursor=pointer]:
        - /url: /auth/signup
  - alert [ref=e28]
```