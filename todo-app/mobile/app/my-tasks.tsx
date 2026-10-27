import { Redirect } from "expo-router";

/** Keep old bookmarks working after moving My Tasks into Calendar. */
export default function MyTasksRoute() {
  return <Redirect href="/calendar" />;
}
