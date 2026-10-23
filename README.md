# Janus

![Janus](todo-app/public/icon-512.png)

Janus is a local-first task manager inspired by the Roman god of thresholds
and transitions. It provides web and mobile clients for tasks, boards,
calendar planning, and progress insights without an account or backend.

## Applications

| Application | Directory | Start command |
|---|---|---|
| Web | `todo-app/` | `npm run dev` |
| Mobile | `todo-app/mobile/` | `npm start` |

The web client uses Next.js, React, TypeScript, and Tailwind CSS. The mobile
client uses Expo, React Native, and Expo Router. Both clients keep workspace
data on the device.

## Checks

```bash
# Web
cd todo-app
npm run lint
npx tsc --noEmit
npm run build

# Mobile
cd mobile
npm run lint
npm run typecheck
```

Course documentation is in [`sopm-docs/`](sopm-docs/).
