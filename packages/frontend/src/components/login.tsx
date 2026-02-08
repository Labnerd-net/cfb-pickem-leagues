import React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Credentials } from '@shared/types/cfb-pickem-api';
import { loginUser } from '../apis/authRequests';

// Define the schema
const LoginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const LoginForm: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credentials>({ resolver: zodResolver(LoginSchema) });

  const onSubmit: SubmitHandler<Credentials> = async (credentials: Credentials) => {
    console.log('Login Data:', credentials);
    const token = await loginUser(credentials);
    console.log('Login Token:', token);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Email Field */}
      <div>
        <label>Email:</label>
        <input type="email" {...register('email')} />
        {errors.email && <p>{errors.email.message}</p>}
      </div>

      {/* Password Field */}
      <div>
        <label>Password:</label>
        <input type="password" {...register('password')} />
        {errors.password && <p>{errors.password.message}</p>}
      </div>

      {/* Submit Button */}
      <button type="submit">Login</button>
    </form>
  );
};

export default LoginForm;
