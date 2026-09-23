package com.smartapartment.config;

import com.smartapartment.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import com.smartapartment.repository.AppUserRepository;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/saas",
                                "/saas/**",
                                "/login",
                                "/register",
                                "/favicon.svg",
                                "/shared/**",
                                "/smartapartment/**",
                                "/propertydirect/**",
                                "/dashboards/**",
                                "/resident/**",
                                "/feedback/**",
                                "/terms/**",
                                "/error",
                                "/api/auth/**"
                        ).permitAll()
                        .requestMatchers("/api/mail/report-apartment").permitAll()
                        .requestMatchers("/api/properties/public").permitAll()
                        .requestMatchers("/api/admin/properties/**").permitAll()
                        .requestMatchers("/api/property/**").permitAll()
                        .requestMatchers("/api/common-maintenance/**").permitAll()
                        .requestMatchers("/api/maintenance/**").permitAll()
                        .requestMatchers("/api/workflows/**").permitAll()
                        .requestMatchers("/api/billing/**").hasAnyRole("SOCIETY_ADMIN", "ACCOUNTANT")
                        .requestMatchers("/api/society/**").authenticated()
                        .requestMatchers("/admin/**").hasAnyRole("SUPER_ADMIN", "SOCIETY_ADMIN")
                        .requestMatchers("/api/platform/**").hasRole("SUPER_ADMIN")
                        .requestMatchers("/api/superadmin/**").hasRole("SUPER_ADMIN")
                        .anyRequest().authenticated()
                )
                .formLogin(login -> login
                        .loginPage("/")
                        .defaultSuccessUrl("/dashboard", true)
                        .permitAll()
                )
                .logout(logout -> logout.logoutSuccessUrl("/?loggedOut=true").permitAll())
                .headers(headers -> headers.frameOptions(frame -> frame.disable()))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(AppUserRepository userRepository) {
        return username -> userRepository.findByEmail(username)
                .map(user -> org.springframework.security.core.userdetails.User
                        .withUsername(user.getEmail())
                        .password(user.getPasswordHash())
                        .roles(user.getRole().name())
                        .accountLocked(user.isAccountLocked())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
