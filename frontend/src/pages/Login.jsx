import { useAuth } from "../context/AuthContext";
export default function Login() {
  const auth = useAuth();
  console.log("auth context:", auth);
  return <h1>Login</h1>;
}
