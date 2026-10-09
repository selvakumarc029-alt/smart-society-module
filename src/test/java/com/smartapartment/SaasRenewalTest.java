package com.smartapartment;
import com.smartapartment.controller.SaasRenewalController;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
public class SaasRenewalTest {
 public static void main(String[] args) throws Exception {
  var current=mock(CurrentUserService.class);var tenants=mock(TenantRepository.class);var plans=mock(SubscriptionPlanRepository.class);var payments=mock(SaasRenewalPaymentRepository.class);
  var controller=new SaasRenewalController(current,tenants,plans,payments);
  when(current.requireTenantId()).thenReturn("society-a");
  Tenant tenant=new Tenant();tenant.setSubscriptionPlanId(1L);tenant.setSubscriptionRenewsOn(LocalDate.now().plusDays(10));
  when(tenants.findByCode("society-a")).thenReturn(Optional.of(tenant));
  SubscriptionPlan plan=new SubscriptionPlan();plan.setId(1L);plan.setName("Gold");plan.setMonthlyPrice(new BigDecimal("100"));plan.setBillingCycle("YEARLY");
  when(plans.findById(1L)).thenReturn(Optional.of(plan));
  ReflectionTestUtils.setField(controller,"upi","");ReflectionTestUtils.setField(controller,"payee","");
  assertEquals(false,controller.renewal().get("configured"));assertThrows(ResponseStatusException.class,controller::qr);
  ReflectionTestUtils.setField(controller,"upi","test@invalid");ReflectionTestUtils.setField(controller,"payee","Test only");
  byte[] qr=controller.qr();assertEquals((byte)137,qr[0]);assertEquals((byte)80,qr[1]);
  when(payments.save(any())).thenAnswer(x->x.getArgument(0));when(payments.findByTenantIdOrderByCreatedAtDesc("society-a")).thenReturn(List.of());
  var payment=controller.submit(new SaasRenewalController.Submission("TEST12345678"));assertEquals("PENDING_VERIFICATION",payment.getStatus());assertEquals("society-a",payment.getTenantId());assertNull(payment.getCycleEnd());
  when(payments.existsByTransactionReference("TEST12345678")).thenReturn(true);assertThrows(ResponseStatusException.class,()->controller.submit(new SaasRenewalController.Submission("TEST12345678")));
  when(payments.findById(2L)).thenReturn(Optional.of(payment));LocalDate expectedStart=tenant.getSubscriptionRenewsOn().plusDays(1);
  controller.review(2L,new SaasRenewalController.Review(true));assertEquals(expectedStart,payment.getCycleStart());assertEquals(expectedStart.plusYears(1).minusDays(1),tenant.getSubscriptionRenewsOn());assertEquals("VERIFIED",payment.getStatus());
  assertThrows(ResponseStatusException.class,()->controller.review(2L,new SaasRenewalController.Review(true)));
  System.out.println("SaaS tests passed: QR configuration, tenant scope, pending submission, duplicate rejection, annual renewal, repeated approval rejection.");
 }
}
