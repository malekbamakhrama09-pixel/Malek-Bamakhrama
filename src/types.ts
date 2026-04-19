export interface ResumeData {
  id?: string;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  projects?: Project[];
  isTailored?: boolean;
  targetJobDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Experience {
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string[];
}

export interface Education {
  school: string;
  degree: string;
  field: string;
  location: string;
  graduationDate: string;
}

export interface Project {
  name: string;
  description: string;
  link?: string;
}

export type ToolType = 'resume' | 'assistant' | 'content';
