import { GoogleGenAI, Type } from "@google/genai";
import { ResumeData } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

const CV_SYSTEM_PROMPT = `You are a premium professional CV writer specializing in the Gulf market (UAE, Qatar, Saudi Arabia, Kuwait, Bahrain, Oman).
Your mission is to create high-converting, ATS-optimized resumes that help candidates get 3x more interviews at top regional and multinational firms.

GULF ADVANTAGE GUIDELINES:
- Use a professional, authoritative, and results-driven tone.
- Focus on measurable achievements (KPIs, percentages, currency values) rather than just duties.
- Align with hiring expectations in Dubai, Riyadh, and Doha.
- Ensure job titles are clear and recognized in the GCC region.

FORMATTING REQUIREMENTS:
- Use clear sections: Professional Summary, Work Experience, Skills, and Education.
- Use clean bullet points for experience.
- Ensure consistent spacing and professional formatting.
- The summary should be a punchy, 3-4 sentence paragraph that defines the candidate's value proposition.`;

export const generateResume = async (
  rawDetails: string, 
  jobTitle: string,
  yearsExp: string
): Promise<ResumeData> => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Generate a professional Gulf-market optimized CV based on the following details:
    Target Job: ${jobTitle}
    Years of Experience: ${yearsExp}
    Candidate Details: ${rawDetails}

    Specific Instructions:
    - Tailor the summary to the Target Job.
    - Quantify achievements in the experience section (e.g., "Increased sales by 15% in Q3").
    - Use recognized GCC terminology.
    - Ensure visually clean formatting ready for PDF export.`,
    config: {
      systemInstruction: CV_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["fullName", "email", "phone", "location", "summary", "experience", "education", "skills"],
        properties: {
          fullName: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          location: { type: Type.STRING },
          summary: { type: Type.STRING },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["company", "position", "startDate", "endDate", "description"],
              properties: {
                company: { type: Type.STRING },
                position: { type: Type.STRING },
                location: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                description: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["school", "degree", "field", "graduationDate"],
              properties: {
                school: { type: Type.STRING },
                degree: { type: Type.STRING },
                field: { type: Type.STRING },
                location: { type: Type.STRING },
                graduationDate: { type: Type.STRING }
              }
            }
          },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}') as ResumeData;
};

export const tailorResume = async (
  currentCV: ResumeData, 
  jobDescription: string
): Promise<ResumeData> => {
  const model = "gemini-3-flash-preview";
  const systemPrompt = `You are an expert recruiter and CV optimizer. Your task is to tailor resumes to match job descriptions for ATS systems.
Prioritize keyword matching, relevance, and measurable achievements.`;

  const response = await ai.models.generateContent({
    model,
    contents: `Here is a CV:
${JSON.stringify(currentCV)}

Here is the job description:
${jobDescription}

Tasks:
- Rewrite the CV to better match the job description
- Add relevant keywords naturally
- Highlight the most relevant experience
- Keep it professional and concise
- Do not fabricate experience, only optimize wording
    
Return the result as a strictly formatted JSON object matching the provided resume schema.`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(response.text || '{}');
};

export const generateCoverLetter = async (
  resumeData: ResumeData, 
  jobDescription: string
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const systemPrompt = `You are a professional career coach writing persuasive and concise cover letters tailored for job applications in the Gulf region.`;

  const response = await ai.models.generateContent({
    model,
    contents: `Write a cover letter based on:

Candidate CV:
${JSON.stringify(resumeData)}

Job Description:
${jobDescription}

Requirements:
- Keep it under 300 words
- Make it personalized and engaging
- Highlight 2–3 key achievements relevant to the job
- Use a confident and professional tone`,
    config: { systemInstruction: systemPrompt }
  });
  return response.text || '';
};

export interface ATSFeedback {
  missingKeywords: string[];
  suggestedImprovements: string[];
  score: number;
}

export const checkATSScore = async (
  resumeData: ResumeData, 
  jobDescription: string
): Promise<ATSFeedback> => {
  const model = "gemini-3-flash-preview";
  const response = await ai.models.generateContent({
    model,
    contents: `Compare this CV with the job description and provide ATS feedback.
    
    CV:
    ${JSON.stringify(resumeData)}
    
    Job Description:
    ${jobDescription}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["missingKeywords", "suggestedImprovements", "score"],
        properties: {
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
          score: { type: Type.NUMBER, description: "Match score out of 100" }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};
