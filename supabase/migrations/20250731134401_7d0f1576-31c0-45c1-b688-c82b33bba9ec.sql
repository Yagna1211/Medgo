-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  medical_conditions TEXT,
  allergies TEXT,
  current_medications TEXT,
  preferred_language TEXT DEFAULT 'English',
  notification_preferences BOOLEAN DEFAULT true,
  data_sharing_consent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create medicine_scans table
CREATE TABLE public.medicine_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT,
  medicine_name TEXT,
  generic_name TEXT,
  manufacturer TEXT,
  confidence_score DECIMAL,
  uses TEXT,
  dosage TEXT,
  side_effects TEXT,
  precautions TEXT,
  active_ingredients TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.medicine_scans ENABLE ROW LEVEL SECURITY;

-- Create policies for medicine_scans
CREATE POLICY "Users can view their own scans" 
ON public.medicine_scans 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scans" 
ON public.medicine_scans 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scans" 
ON public.medicine_scans 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scans" 
ON public.medicine_scans 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create symptom_analyses table
CREATE TABLE public.symptom_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptoms TEXT[] NOT NULL,
  additional_info TEXT,
  urgency_level TEXT,
  possible_conditions JSONB,
  general_recommendations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.symptom_analyses ENABLE ROW LEVEL SECURITY;

-- Create policies for symptom_analyses
CREATE POLICY "Users can view their own analyses" 
ON public.symptom_analyses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses" 
ON public.symptom_analyses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses" 
ON public.symptom_analyses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses" 
ON public.symptom_analyses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();