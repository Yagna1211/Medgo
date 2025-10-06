import { z } from 'zod';

// Auth validation schemas
export const signInSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(100, { message: "Password must be less than 100 characters" }),
});

export const signUpSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(100, { message: "Password must be less than 100 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  firstName: z.string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be less than 50 characters" }),
  lastName: z.string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be less than 50 characters" }),
  role: z.enum(['customer', 'driver'], { message: "Invalid role" }),
});

export const driverSignUpSchema = signUpSchema.extend({
  phone: z.string()
    .trim()
    .min(1, { message: "Phone number is required" })
    .regex(/^[0-9]{10}$/, { message: "Phone number must be exactly 10 digits" }),
  ambulanceNumber: z.string()
    .trim()
    .min(1, { message: "Ambulance number is required" })
    .max(50, { message: "Ambulance number must be less than 50 characters" }),
  vehicleDetails: z.string()
    .trim()
    .min(1, { message: "Vehicle details are required" })
    .max(200, { message: "Vehicle details must be less than 200 characters" }),
  serviceArea: z.string()
    .trim()
    .min(1, { message: "Service area is required" })
    .max(100, { message: "Service area must be less than 100 characters" }),
});

export const emergencyBookingSchema = z.object({
  patientName: z.string()
    .trim()
    .min(1, { message: "Patient name is required" })
    .max(100, { message: "Patient name must be less than 100 characters" }),
  patientPhone: z.string()
    .trim()
    .min(1, { message: "Phone number is required" })
    .regex(/^[0-9]{10}$/, { message: "Phone number must be exactly 10 digits" }),
  emergencyType: z.string()
    .trim()
    .min(1, { message: "Emergency type is required" })
    .max(50, { message: "Emergency type must be less than 50 characters" }),
  pickupAddress: z.string()
    .trim()
    .min(1, { message: "Pickup address is required" })
    .max(500, { message: "Pickup address must be less than 500 characters" }),
  additionalInfo: z.string()
    .trim()
    .max(1000, { message: "Additional info must be less than 1000 characters" })
    .optional(),
});

// Profile update validation
export const profileUpdateSchema = z.object({
  firstName: z.string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be less than 50 characters" })
    .optional(),
  lastName: z.string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be less than 50 characters" })
    .optional(),
  phone: z.string()
    .trim()
    .regex(/^[0-9]{10}$/, { message: "Phone number must be exactly 10 digits" })
    .optional(),
  emergencyContactName: z.string()
    .trim()
    .max(100, { message: "Emergency contact name must be less than 100 characters" })
    .optional(),
  emergencyContactPhone: z.string()
    .trim()
    .regex(/^[0-9]{10}$/, { message: "Phone number must be exactly 10 digits" })
    .optional(),
});
