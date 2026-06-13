import { API_BASE_URL } from '../components/constants/api.example';

export const sendOtp = async (email) => {
  const response = await fetch(
    `${API_BASE_URL}/api/otp/send-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    }
  );

  return response.json();
};

export const verifyOtp = async (email, otp) => {
  const response = await fetch(
    `${API_BASE_URL}/api/otp/verify-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, otp }),
    }
  );

  return response.json();
};