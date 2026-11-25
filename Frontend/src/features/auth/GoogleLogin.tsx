import { GoogleLogin as GoogleOAuthButton } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authService } from "./auth.service";
import { useAuth } from "../../hooks/useAuth";

export default function GoogleLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="w-full flex justify-center bg-[#EBF7EE] rounded-xl py-2.5 px-3 border border-emerald-100">
      <GoogleOAuthButton
        onSuccess={async (credentialResponse) => {
          const idToken = credentialResponse.credential;
          if (!idToken) {
            toast.error("Google login failed — no ID token received");
            return;
          }
          try {
            const { data } = await authService.googleLogin(idToken);
            login(data.token, data.user);
            toast.success(`Welcome, ${data.user.name}!`);
            navigate("/dashboard", { replace: true });
          } catch (err: unknown) {
            const errObj = err as {
              response?: { data?: { error?: string } };
              message?: string;
            };
            const errorMsg =
              errObj.response?.data?.error ||
              (errObj.response
                ? "Google authentication failed"
                : "Cannot connect to Backend (ensure Backend is running on port 5000)");
            toast.error(errorMsg);
          }
        }}
        onError={() => toast.error("Google login failed")}
        width="320"
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
      />
    </div>
  );
}
