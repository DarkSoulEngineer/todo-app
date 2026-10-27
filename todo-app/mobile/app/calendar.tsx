import { Redirect } from "expo-router";

/** Calendar now lives inside boards; preserve old links to the main overview. */
export default function CalendarRoute() {
  return <Redirect href="/top-tasks" />;
}
