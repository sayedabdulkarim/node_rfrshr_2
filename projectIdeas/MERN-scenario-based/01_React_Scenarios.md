# React - Scenario Based Interview Questions

> "Bhai React toh aata hai, but jab interviewer situation deta hai toh dimag blank"

---


## Scenario 1: Unnecessary Re-renders

**Q: Tumhara ek component hai jo bahut slow render ho raha hai. Parent component mein kuch
bhi change hota hai toh ye child re-render hota hai, even though iske props nahi badle.
Kaise fix karoge?**

**Answer:**

Step 1 - Diagnose:
- React DevTools Profiler open karo
- "Highlight updates when components render" enable karo
- Dekho kaunse components unnecessary re-render ho rahe hain

Step 2 - Root causes:
- Parent re-render hota hai -> sabhi children re-render hote hain (default React behavior)
- Props mein naya object/array/function har render pe ban raha hai (reference change)

Step 3 - Fixes:

```jsx
// Fix 1: React.memo - skip re-render if props same
const ChildComponent = React.memo(({ data, onClick }) => {
  return <div onClick={onClick}>{data.name}</div>
})

// Fix 2: useMemo - memoize expensive computed values
const filteredList = useMemo(() => {
  return items.filter(item => item.active)
}, [items])  // only recompute when items change

// Fix 3: useCallback - memoize functions passed as props
const handleClick = useCallback((id) => {
  setSelected(id)
}, [])  // function reference stays same across renders

// Fix 4: Avoid inline objects in JSX
// BAD: creates new object every render
<Child style={{ color: 'red' }} />

// GOOD: define outside or useMemo
const style = useMemo(() => ({ color: 'red' }), [])
<Child style={style} />
```

Step 4 - Prevention:
- React DevTools Profiler regularly check karo
- Component boundaries sahi jagah rakho (small, focused components)


---


## Scenario 2: Stale Closure

**Q: Tumhara useEffect mein ek setInterval hai jo counter update karta hai.
But counter hamesha 1 hi dikhata hai, increment nahi ho raha. Kya problem hai?**

**Answer:**

Ye classic stale closure problem hai:

```jsx
// BUG: count hamesha 0 rahega
const [count, setCount] = useState(0)

useEffect(() => {
  const interval = setInterval(() => {
    setCount(count + 1)  // count = 0 (closure captured initial value)
  }, 1000)
  return () => clearInterval(interval)
}, [])  // empty deps = effect runs once, captures count = 0

// FIX 1: Functional update (BEST)
useEffect(() => {
  const interval = setInterval(() => {
    setCount(prev => prev + 1)  // prev = always latest value
  }, 1000)
  return () => clearInterval(interval)
}, [])

// FIX 2: useRef to track latest value
const countRef = useRef(count)
countRef.current = count

useEffect(() => {
  const interval = setInterval(() => {
    setCount(countRef.current + 1)
  }, 1000)
  return () => clearInterval(interval)
}, [])
```

**Why it happens:** useEffect ka callback closure banata hai. Jab dependency array empty hai,
toh closure sirf initial render ke values capture karta hai. `count` hamesha 0 rahega us closure mein.


---


## Scenario 3: Large List Performance

**Q: Tumhare paas ek list hai jismein 10,000 items hain. Page bahut slow ho gaya hai,
scrolling laggy hai. Kaise optimize karoge?**

**Answer:**

Step 1 - Problem: 10K DOM nodes = browser struggle karta hai render + paint mein

Step 2 - Solution: Virtualization (sirf visible items render karo)

```jsx
// react-window use karo (lightweight)
import { FixedSizeList as List } from 'react-window'

const MyList = ({ items }) => (
  <List
    height={600}           // viewport height
    itemCount={items.length}
    itemSize={50}          // each row height
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        {items[index].name}
      </div>
    )}
  </List>
)

// Agar variable height rows hain -> VariableSizeList use karo
```

Step 3 - Additional optimizations:
- Pagination: backend se 50 items at a time (better UX)
- Infinite scroll: intersection observer + load more
- Search/filter: server-side filtering (don't filter 10K on client)
- Debounce search input: 300ms delay before filtering

```jsx
// Debounced search
const [search, setSearch] = useState('')
const debouncedSearch = useMemo(
  () => debounce((value) => fetchResults(value), 300),
  []
)

const handleSearch = (e) => {
  setSearch(e.target.value)
  debouncedSearch(e.target.value)
}
```


---


## Scenario 4: Race Condition in API Calls

**Q: User search bar mein type kar raha hai. Har keystroke pe API call ja rahi hai.
But kabhi kabhi purana result naye result ke baad aa jaata hai aur galat data dikhta hai.
Kaise fix karoge?**

**Answer:**

Ye classic race condition hai. Request A pehle gayi but response late aaya,
Request B baad mein gayi but response pehle aa gaya.

```jsx
// FIX 1: AbortController (BEST approach)
useEffect(() => {
  const controller = new AbortController()

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/search?q=${query}`, {
        signal: controller.signal
      })
      const data = await res.json()
      setResults(data)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err)
      }
    }
  }

  if (query) fetchResults()

  // Cleanup: cancel previous request when query changes
  return () => controller.abort()
}, [query])


// FIX 2: useRef with request ID
const latestRequestId = useRef(0)

const handleSearch = async (query) => {
  const requestId = ++latestRequestId.current

  const data = await fetch(`/api/search?q=${query}`).then(r => r.json())

  // Only update if this is still the latest request
  if (requestId === latestRequestId.current) {
    setResults(data)
  }
}


// FIX 3: Debounce + AbortController (PRODUCTION approach)
// Debounce input -> then fetch with abort
const debouncedQuery = useDebounce(query, 300)

useEffect(() => {
  const controller = new AbortController()

  if (debouncedQuery) {
    fetch(`/api/search?q=${debouncedQuery}`, { signal: controller.signal })
      .then(r => r.json())
      .then(setResults)
      .catch(() => {})
  }

  return () => controller.abort()
}, [debouncedQuery])
```


---


## Scenario 5: Memory Leak in useEffect

**Q: Tumhare app mein ek component hai jo mount hone pe WebSocket connection open karta hai.
User jab page switch karta hai toh component unmount hota hai, but memory usage badhti jaa rahi hai.
Kya problem hai?**

**Answer:**

Cleanup nahi ho raha unmount pe = memory leak.

```jsx
// BUG: No cleanup
useEffect(() => {
  const socket = io('ws://localhost:3001')

  socket.on('message', (data) => {
    setMessages(prev => [...prev, data])
  })

  // Missing cleanup! Socket stays open after unmount
}, [])


// FIX: Proper cleanup
useEffect(() => {
  const socket = io('ws://localhost:3001')

  socket.on('message', (data) => {
    setMessages(prev => [...prev, data])
  })

  // Cleanup on unmount
  return () => {
    socket.off('message')   // remove listener
    socket.disconnect()      // close connection
  }
}, [])
```

Common memory leak sources in React:
1. WebSocket/EventSource not disconnected
2. setInterval/setTimeout not cleared
3. Event listeners (window.addEventListener) not removed
4. Async operations updating state after unmount
5. Subscriptions (Redux, Firebase) not unsubscribed

```jsx
// Async state update after unmount - FIX with AbortController
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(data => setData(data))  // safe: aborted if unmounted
    .catch(() => {})

  return () => controller.abort()
}, [])
```


---


## Scenario 6: Context API Performance

**Q: Tumne ek global AuthContext banaya hai jismein user info + theme + language sab hai.
Jab theme change hota hai toh poora app re-render hota hai, even login form bhi.
Kaise fix karoge?**

**Answer:**

Problem: Ek bada context = har value change pe SAB consumers re-render

```jsx
// BAD: Everything in one context
const AppContext = createContext()

function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  const [language, setLanguage] = useState('en')

  return (
    <AppContext.Provider value={{ user, theme, language, setTheme }}>
      {children}
    </AppContext.Provider>
  )
}
// Problem: theme change -> naya object -> SAB re-render


// FIX: Split into separate contexts
const AuthContext = createContext()
const ThemeContext = createContext()
const LanguageContext = createContext()

function AppProvider({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

// Now: theme change -> sirf ThemeContext consumers re-render
// Login form (uses AuthContext) -> NOT affected
```

Additional fix: useMemo on context value

```jsx
function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  // Memoize value object to prevent unnecessary re-renders
  const value = useMemo(() => ({ user, setUser }), [user])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
```


---


## Scenario 7: Form Performance

**Q: Tumhara ek complex form hai - 30+ fields. Har keystroke pe poora form re-render hota hai
aur input lagging feel hota hai. Kaise fix karoge?**

**Answer:**

Problem: Controlled components + single state object = har keystroke pe entire form re-render

```jsx
// BAD: Single state, everything re-renders
const [form, setForm] = useState({ name: '', email: '', ... })

const handleChange = (field) => (e) => {
  setForm(prev => ({ ...prev, [field]: e.target.value }))
  // ^ Triggers re-render of ENTIRE form on every keystroke
}


// FIX 1: React Hook Form (BEST for complex forms)
import { useForm } from 'react-hook-form'

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm()

  // Each field is uncontrolled -> NO re-render on keystroke
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name', { required: true })} />
      {errors.name && <span>Name required</span>}
      <input {...register('email', { pattern: /^\S+@\S+$/i })} />
      <button type="submit">Submit</button>
    </form>
  )
}
// React Hook Form uses refs internally -> ZERO re-renders while typing


// FIX 2: Isolate each field into its own component
const FormField = React.memo(({ name, value, onChange }) => {
  return <input value={value} onChange={onChange} />
})

// Each field only re-renders when ITS value changes


// FIX 3: Debounce state updates
const [name, setName] = useState('')
const debouncedSetName = useMemo(
  () => debounce(setName, 150),
  []
)
// Reduces re-renders: state updates after 150ms pause
```


---


## Scenario 8: Code Splitting / Lazy Loading

**Q: Tumhara app ka initial bundle size 3MB hai. First page load mein 8 seconds lag raha hai.
Users bounce kar rahe hain. Kaise reduce karoge?**

**Answer:**

Step 1 - Analyze bundle:
```bash
# Bundle analyzer se dekho kya heavy hai
npm install --save-dev webpack-bundle-analyzer
npx webpack-bundle-analyzer build/stats.json
```

Step 2 - Route-based code splitting:
```jsx
// BEFORE: Everything loaded upfront
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'

// AFTER: Load on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const Analytics = lazy(() => import('./pages/Analytics'))

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  )
}
```

Step 3 - Additional optimizations:
```
- Tree shaking: import { debounce } from 'lodash-es' (NOT import _ from 'lodash')
- Dynamic imports: heavy libraries load when needed
- Image optimization: WebP format, lazy loading, srcset
- Compression: gzip/brotli on server
- CDN: serve static assets from CDN
- Prefetch: <link rel="prefetch"> for next likely route
```


---


## Scenario 9: Hydration Mismatch (SSR)

**Q: Tum Next.js use kar rahe ho. Server pe page sahi render hota hai but client pe
"Hydration mismatch" error aa raha hai. Content bhi flicker karta hai. Kya ho raha hai?**

**Answer:**

Hydration mismatch = Server HTML !== Client HTML jab React hydrate karta hai.

Common causes:
```jsx
// Cause 1: Using browser-only APIs during render
// BAD:
function Component() {
  return <div>{window.innerWidth}</div>  // window undefined on server
}

// FIX: useEffect for browser-only code
function Component() {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    setWidth(window.innerWidth)
  }, [])
  return <div>{width}</div>
}


// Cause 2: Date/Time differences
// BAD:
function Component() {
  return <span>{new Date().toLocaleString()}</span>
  // Server time !== Client time -> mismatch
}

// FIX: Render on client only
function Component() {
  const [date, setDate] = useState('')
  useEffect(() => {
    setDate(new Date().toLocaleString())
  }, [])
  return <span>{date}</span>
}


// Cause 3: Conditional rendering based on localStorage
// BAD:
function Component() {
  const theme = localStorage.getItem('theme') || 'light'
  // localStorage doesn't exist on server
}

// FIX: Default on server, update on client
function Component() {
  const [theme, setTheme] = useState('light')  // server default
  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')
  }, [])
}


// Cause 4: Extensions/browser modifications
// Browser extensions inject HTML -> mismatch
// FIX: suppressHydrationWarning on affected elements
<div suppressHydrationWarning>{dynamicContent}</div>
```


---


## Scenario 10: Infinite Loop in useEffect

**Q: Component mount hote hi infinite API calls ja rahe hain. Network tab mein
hundreds of requests dikh rahe hain. Kya galat hai?**

**Answer:**

```jsx
// BUG 1: Missing dependency array
useEffect(() => {
  fetchData()  // runs on EVERY render -> state update -> re-render -> infinite
})
// FIX: Add dependency array
useEffect(() => { fetchData() }, [])


// BUG 2: Object/Array in dependency
useEffect(() => {
  fetchData(filters)
}, [filters])
// If filters = { status: 'active' } is created in render:
const filters = { status: 'active' }  // NEW object every render -> infinite

// FIX: useMemo the object, or use primitive deps
const filters = useMemo(() => ({ status: 'active' }), [])
// OR
useEffect(() => { fetchData({ status }) }, [status])  // primitive


// BUG 3: setState inside useEffect without guard
useEffect(() => {
  fetch('/api/data')
    .then(r => r.json())
    .then(data => {
      setItems(data)        // state update -> re-render
      setLoading(false)     // state update -> re-render
    })
}, [items])  // items changed -> effect runs again -> infinite!

// FIX: Remove items from deps (it's the OUTPUT, not INPUT)
useEffect(() => {
  fetch('/api/data')
    .then(r => r.json())
    .then(data => {
      setItems(data)
      setLoading(false)
    })
}, [])  // run once on mount
```


---


## Scenario 11: Error Boundary

**Q: Tumhara app mein ek component crash hota hai toh poora app white screen ho jaata hai.
User ko kuch nahi dikhta. Kaise handle karoge?**

**Answer:**

```jsx
// Error Boundary - class component (React mein abhi bhi class hi chahiye)
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log to monitoring service (Sentry, LogRocket)
    logErrorToService(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Usage: Wrap sections, NOT the entire app
function App() {
  return (
    <div>
      <Header />  {/* If header crashes, page still works */}
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
    </div>
  )
}
```

Key point: Error boundaries catch RENDER errors only.
They DON'T catch: event handlers, async code, SSR errors.
For those, use try-catch.


---


## Scenario 12: State Not Updating Immediately

**Q: Tum setState call karte ho aur TURANT uski value use karna chahte ho,
but purani value milti hai. Kya ho raha hai?**

**Answer:**

```jsx
// BUG: setState is ASYNCHRONOUS (batched)
const [count, setCount] = useState(0)

const handleClick = () => {
  setCount(count + 1)
  console.log(count)  // Still 0! Not 1!
  // React batches updates, re-renders AFTER function completes
}


// FIX 1: Use the value you're SETTING, not the state
const handleClick = () => {
  const newCount = count + 1
  setCount(newCount)
  console.log(newCount)  // 1 - correct!
  doSomething(newCount)  // use the local variable
}


// FIX 2: useEffect to react to state changes
useEffect(() => {
  console.log('Count updated:', count)  // runs AFTER re-render
  doSomething(count)
}, [count])


// FIX 3: useRef for latest value (when needed in callbacks)
const countRef = useRef(count)
countRef.current = count

const handleDelayedAction = () => {
  setTimeout(() => {
    console.log(countRef.current)  // always latest
  }, 3000)
}
```


---


## Scenario 13: Props Drilling Hell

**Q: Tumhara app mein data 5-6 levels deep pass hona chahiye. Props drilling
se code unreadable ho gaya hai. Har component mein same props pass ho rahe hain.
Kaise solve karoge?**

**Answer:**

```
// THE PROBLEM:
App -> Layout -> Sidebar -> Menu -> MenuItem -> Icon
  (user prop passed through ALL levels, used only in Icon)
```

Solutions (pick based on scale):

```jsx
// Solution 1: Context API (small-medium apps)
const UserContext = createContext()

function App() {
  const [user, setUser] = useState(null)
  return (
    <UserContext.Provider value={user}>
      <Layout />  {/* no props needed */}
    </UserContext.Provider>
  )
}

function Icon() {
  const user = useContext(UserContext)  // direct access, skip 4 levels
  return <img src={user.avatar} />
}


// Solution 2: Component Composition (often overlooked, very clean)
// Instead of passing data down, pass COMPONENTS down

// BEFORE (drilling):
<Layout user={user}>       ->  <Sidebar user={user}>  ->  <Avatar user={user} />

// AFTER (composition):
function App() {
  return (
    <Layout
      sidebar={<Sidebar avatar={<Avatar user={user} />} />}
    />
  )
}
// Layout doesn't need to know about user at all!


// Solution 3: State management (large apps)
// Zustand (lightweight, simple)
import { create } from 'zustand'

const useUserStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))

// Any component, any depth:
function Icon() {
  const user = useUserStore((state) => state.user)
  return <img src={user.avatar} />
}
```


---


## Scenario 14: Optimistic UI Update

**Q: User "Like" button dabata hai. API call 500ms leti hai.
User ko turant feedback chahiye, wait nahi karna chahta.
But agar API fail ho jaaye toh kya karoge?**

**Answer:**

```jsx
// Optimistic Update Pattern
const [liked, setLiked] = useState(false)
const [likeCount, setLikeCount] = useState(42)

const handleLike = async () => {
  // Step 1: Update UI IMMEDIATELY (optimistic)
  const previousLiked = liked
  const previousCount = likeCount

  setLiked(true)
  setLikeCount(prev => prev + 1)

  try {
    // Step 2: Send API request
    await api.post(`/posts/${postId}/like`)
  } catch (error) {
    // Step 3: ROLLBACK if API fails
    setLiked(previousLiked)
    setLikeCount(previousCount)
    toast.error('Like failed. Please try again.')
  }
}
```

React Query / TanStack Query has built-in optimistic update support:

```jsx
const likeMutation = useMutation({
  mutationFn: () => api.post(`/posts/${postId}/like`),
  onMutate: async () => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['post', postId])

    // Snapshot previous value
    const previous = queryClient.getQueryData(['post', postId])

    // Optimistically update
    queryClient.setQueryData(['post', postId], (old) => ({
      ...old,
      likes: old.likes + 1,
      isLiked: true,
    }))

    return { previous }  // context for rollback
  },
  onError: (err, vars, context) => {
    // Rollback on error
    queryClient.setQueryData(['post', postId], context.previous)
  },
  onSettled: () => {
    // Refetch to ensure sync with server
    queryClient.invalidateQueries(['post', postId])
  },
})
```


---


## Scenario 15: Dynamic Imports Based on User Role

**Q: Tumhara app mein Admin dashboard bahut heavy hai (charts, tables, analytics).
Normal users ko ye load nahi hona chahiye. Kaise ensure karoge ki
admin code sirf admin ke liye load ho?**

**Answer:**

```jsx
// Dynamic import based on role
function Dashboard() {
  const { user } = useAuth()

  // Admin panel loads ONLY when admin logs in
  const AdminPanel = user.role === 'admin'
    ? lazy(() => import('./AdminPanel'))
    : null

  return (
    <div>
      <UserDashboard />

      {AdminPanel && (
        <Suspense fallback={<Spinner />}>
          <AdminPanel />
        </Suspense>
      )}
    </div>
  )
}

// Bundle result:
// - main.js: ~200KB (user dashboard)
// - AdminPanel.chunk.js: ~500KB (loaded ONLY for admins)
// Normal users never download admin code = faster load + security
```

Bonus: Route-level protection
```jsx
const AdminRoutes = lazy(() => import('./routes/AdminRoutes'))

<Route
  path="/admin/*"
  element={
    <RequireRole role="admin">
      <Suspense fallback={<Spinner />}>
        <AdminRoutes />
      </Suspense>
    </RequireRole>
  }
/>
```


---


*Total: 15 React Scenario Questions*
*Difficulty: Intermediate to Advanced*
*Covers: Re-renders, closures, performance, security, SSR, patterns*
