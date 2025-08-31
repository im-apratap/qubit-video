import "../styles/auth.css";
import { SignInButton } from "@clerk/clerk-react";

const AuthPage = () => {
  return (
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-hero">
          <div className="brand-container">
            <img
              src="/qubit_logo.svg"
              alt="Video-conferencing"
              className="brand-logo"
            />
            <span className="brand-name">QUBIT</span>
          </div>

          <h1 className="hero-title">
            Your one-stop solution for smarter, seamless online classes ✨
          </h1>

          <p className="hero-subtitle">
            Stay connected with your classmates through secure, real-time
            messaging. Collaborate effortlessly, share ideas, and enhance your
            online learning experience with tools built for students.
          </p>

          <div className="features-list">
            <SignInButton mode="modal">
              <button className="cta-button">
                Get Started with Video Calling
                <span className="button-arrow">→</span>
              </button>
            </SignInButton>

            <div className="feature-item">
              <span className="feature-icon">💬</span>
              <span>Real-time messaging</span>
            </div>

            <div className="feature-item">
              <span className="feature-icon">🎥</span>
              <span>Video calls & meetings</span>
            </div>

            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <span>Secure & private</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-image-container">
          <img
            src="/logo.jpg"
            alt="Team collaboration"
            className="auth-image"
          />
          <div className="image-overlay"></div>
        </div>
      </div>
    </div>
  );
};
export default AuthPage;
