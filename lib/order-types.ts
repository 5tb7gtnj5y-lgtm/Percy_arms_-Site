export type ServiceType = "dine_in" | "takeaway";
export type MealType = "adult" | "child";
export type MeatChoice = "chicken" | "beef" | "pork";
export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type ExtraOption = {
  id: string;
  name: string;
  pricePence: number;
  active: boolean;
  sortOrder: number;
};

export type PublicMenuConfig = {
  adultMealPrice: number;
  childMealPrice: number;
  extras: ExtraOption[];
  configured: boolean;
  orderingOpen: boolean;
  chickenAvailable: boolean;
  beefAvailable: boolean;
  porkAvailable: boolean;
  serviceMessage: string;
};

export type AdminMenuConfig = PublicMenuConfig & {
  orderEmail: string;
  emailServiceReady: boolean;
};

export type CartMeal = {
  id: string;
  mealType: MealType;
  meat: MeatChoice;
  quantity: number;
};

export type CartExtra = {
  id: string;
  quantity: number;
};

export type PricedMealLine = CartMeal & {
  name: string;
  unitPricePence: number;
};

export type PricedExtraLine = CartExtra & {
  name: string;
  unitPricePence: number;
};

export type OrderLines = {
  meals: PricedMealLine[];
  extras: PricedExtraLine[];
};

export type OrderConfirmation = {
  reference: string;
  totalPence: number;
  emailStatus: "sent" | "awaiting_setup" | "failed";
};

export type AdminOrder = {
  id: number;
  reference: string;
  service: ServiceType;
  mealDate: string;
  timeSlot: string;
  customerName: string;
  email: string;
  phone: string;
  notes: string;
  lines: OrderLines;
  totalPence: number;
  emailStatus: string;
  status: OrderStatus;
  statusUpdatedAt: string | null;
  allergenAcknowledged: boolean;
  seenAt: string | null;
  createdAt: string;
};
