# IMPORT Demo (ES Modules)

## Kaise chalayein:

```bash
cd server/demo/import
node index.mjs
```

## Output:
```
📦 HelperES module loading...
✅ HelperES module loaded!
🚀 START - Import Demo
⏳ Step 1: Before import
⏳ Step 2: After import
📄 Data: Hello from ES Module!
🏁 END - Import Demo
```

## Samjho:
- `import` compile time pe parse hota (before code runs)
- Modules top pe "hoist" ho jate hain
- Better optimization (tree-shaking)
- `.mjs` extension = ES Module file
