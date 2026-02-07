import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define the schema
const RegistrationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  email: z.email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

type RegistrationData = z.infer<typeof RegistrationSchema>;

const RegistrationForm: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationData>({
    resolver: zodResolver(RegistrationSchema),
  });

  const onSubmit = (data: RegistrationData) => {
    console.log('Registration Data:', data);
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Username Field */}
      <div>
        <label>Username:</label>
        <input type="text" {...register('username')} />
        {errors.username && <p>{errors.username.message}</p>}
      </div>

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
      <button type="submit">Register</button>
    </form>
  );
};

export default RegistrationForm;
