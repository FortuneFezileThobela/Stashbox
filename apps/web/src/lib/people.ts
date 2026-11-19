// One place that decides how a person is shown, so a name can never render blank

export interface Person {
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
}

export const personName = (p?: Person | null): string =>
  p?.fullName?.trim() || p?.username?.trim() || p?.email?.split("@")[0]?.trim() || "Unknown member";

export const personInitials = (p?: Person | null): string => {
  const name = personName(p);
  if (name === "Unknown member") return "?";
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};