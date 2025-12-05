import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.MODE === "development" ? "http://localhost:3000/api" : "/api",
  withCredentials: true,
  timeout: 1200000, // 20 minutes timeout for large file uploads (videos up to 100MB)
});
