// Keep in sync with app/microservices/auth-service/src/schemas.ts.
export const INTERESTS = [
    "Bowling", "Movies", "Restaurants", "Karaoke", "Board games", "Hiking", "Coffee",
    "Concerts", "Sports", "Video games", "Escape rooms", "Mini golf", "Museums", "Parks",
  ] as const;
  export const TRANSPORT = ["Car", "Transit", "Walk or bike"] as const;
  export const PRONOUNS = ["she/her", "he/him", "they/them", "Prefer not to say"] as const;
  export const TRAVEL_OPTIONS = [5, 10, 25, 50] as const;
