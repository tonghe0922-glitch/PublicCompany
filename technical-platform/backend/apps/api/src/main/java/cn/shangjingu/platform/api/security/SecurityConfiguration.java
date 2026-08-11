package cn.shangjingu.platform.api.security;

import cn.shangjingu.platform.api.platform.PlatformFileDownloadGuard;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,OpaqueAccessTokenFilter opaqueAccessTokenFilter,SecurityProblemHandler problemHandler)throws Exception{
        http.csrf(csrf->csrf.disable()).httpBasic(x->x.disable()).formLogin(x->x.disable()).logout(x->x.disable()).requestCache(x->x.disable())
                .sessionManagement(session->session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions->exceptions.authenticationEntryPoint(problemHandler).accessDeniedHandler(problemHandler))
                .authorizeHttpRequests(authorize->authorize
                        .requestMatchers("/actuator/health","/actuator/info").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/v1/auth/login","/api/v1/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/v1/platform/webhooks/*/*").permitAll()
                        .requestMatchers(HttpMethod.GET,"/api/v1/session").hasAuthority("platform.session.read")
                        .requestMatchers(HttpMethod.POST,"/api/v1/session/switch").hasAuthority("platform.session.switch")
                        .requestMatchers(HttpMethod.POST,"/api/v1/auth/logout").hasAuthority("platform.session.logout")
                        .requestMatchers(HttpMethod.POST,"/api/v1/step-up/tickets").hasAuthority("platform.stepup.issue")
                        .requestMatchers(HttpMethod.GET,"/api/v1/platform/files/*/download").hasAuthority(PlatformFileDownloadGuard.PERMISSION)
                        .requestMatchers("/api/v1/processes/P001/**").authenticated()
                        .requestMatchers("/api/v1/processes/P002/**").authenticated()
                        .requestMatchers("/api/v1/processes/P003/**").authenticated()
                        .requestMatchers("/api/v1/processes/P004/**").authenticated()
                        .requestMatchers("/api/v1/processes/P005/**").authenticated()
                        .requestMatchers("/api/v1/phase05/**").authenticated().requestMatchers("/api/v1/workflow/**").authenticated()
                        .requestMatchers("/api/**").denyAll().anyRequest().denyAll())
                .addFilterBefore(opaqueAccessTokenFilter,UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
