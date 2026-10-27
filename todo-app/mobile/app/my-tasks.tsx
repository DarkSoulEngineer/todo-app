import { Redirect } from "expo-router";

/** Keep old bookmarks working after replacing My Tasks with Top Tasks. */
export default function MyTasksRoute() {
  return <Redirect href="/top-tasks" />;
}
