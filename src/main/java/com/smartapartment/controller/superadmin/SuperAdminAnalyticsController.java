package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.*;
import java.time.*;
import java.time.format.TextStyle;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/superadmin/analytics")
public class SuperAdminAnalyticsController {
    private final TenantRepository tenants; private final SubscriptionPlanRepository plans; private final AppUserRepository users;
    private final MaintenanceBillRepository bills; private final VisitorRepository visitors; private final ComplaintRepository complaints;
    public SuperAdminAnalyticsController(TenantRepository tenants, SubscriptionPlanRepository plans, AppUserRepository users, MaintenanceBillRepository bills, VisitorRepository visitors, ComplaintRepository complaints) { this.tenants=tenants;this.plans=plans;this.users=users;this.bills=bills;this.visitors=visitors;this.complaints=complaints; }

    @GetMapping("/data")
    public Map<String,Object> analytics(){
        List<Tenant> societies=tenants.findAllByOrderByCreatedAtDesc().stream().filter(this::real).toList();
        Map<Long,SubscriptionPlan> planById=plans.findAll().stream().collect(Collectors.toMap(SubscriptionPlan::getId,Function.identity(),(a,b)->a));
        List<AppUser> realUsers=users.findAll().stream().filter(u->!demo(u.getTenantId())&&!"platform".equalsIgnoreCase(u.getTenantId())).toList();
        List<MaintenanceBill> realBills=bills.findAll().stream().filter(b->!demo(b.getTenantId())).toList();
        List<Visitor> realVisitors=visitors.findAll().stream().filter(v->!demo(v.getTenantId())).toList();
        List<Complaint> realComplaints=complaints.findAll().stream().filter(c->!demo(c.getTenantId())).toList();
        BigDecimal mrr=societies.stream().filter(s->"ACTIVE".equalsIgnoreCase(s.getSubscriptionStatus())).map(s->planById.get(s.getSubscriptionPlanId())).filter(Objects::nonNull).map(SubscriptionPlan::getMonthlyPrice).filter(Objects::nonNull).reduce(BigDecimal.ZERO,BigDecimal::add);
        long paid=realBills.stream().filter(b->"PAID".equalsIgnoreCase(b.getPaymentStatus())).count(); double paymentRate=realBills.isEmpty()?0:paid*100d/realBills.size();
        List<Complaint> resolved=realComplaints.stream().filter(c->List.of("RESOLVED","CLOSED").contains(String.valueOf(c.getStatus()).toUpperCase())).toList();
        double response=resolved.stream().filter(c->c.getCreatedAt()!=null&&c.getUpdatedAt()!=null).mapToLong(c->Math.max(0,Duration.between(c.getCreatedAt(),c.getUpdatedAt()).toHours())).average().orElse(0);
        Map<String,Long> mix=societies.stream().map(s->Optional.ofNullable(planById.get(s.getSubscriptionPlanId())).map(SubscriptionPlan::getName).orElse("Unassigned")).collect(Collectors.groupingBy(Function.identity(),LinkedHashMap::new,Collectors.counting()));
        Map<String,Object> result=new LinkedHashMap<>(); result.put("generatedAt",java.time.LocalDateTime.now());
        result.put("kpis",Map.of("mrr",mrr,"activeUsers",realUsers.size(),"visitorRecords",realVisitors.size(),"paymentSuccessRate",round(paymentRate),"averageResolutionHours",round(response)));
        result.put("operational",Map.of("gateEntries",realVisitors.size(),"maintenanceRequests",realComplaints.size(),"openPaymentFollowUps",realBills.size()-paid,"registeredSocieties",societies.size()));
        result.put("revenueTrend",revenueTrend(realBills)); result.put("societies",societies.stream().map(s->societyPerformance(s,planById)).toList()); result.put("subscriptionMix",mix); result.put("recommendations",recommendations(societies,realBills,realComplaints)); return result;
    }
    private Map<String,Object> societyPerformance(Tenant society,Map<Long,SubscriptionPlan> planById){String id=society.getTenantId();List<MaintenanceBill> sb=bills.findByTenantIdOrderByDueDateDesc(id);long paid=sb.stream().filter(b->"PAID".equalsIgnoreCase(b.getPaymentStatus())).count();double rate=sb.isEmpty()?0:paid*100d/sb.size();List<Complaint> sc=complaints.findByTenantIdOrderByCreatedAtDesc(id);long open=sc.stream().filter(c->!List.of("RESOLVED","CLOSED").contains(String.valueOf(c.getStatus()).toUpperCase())).count();SubscriptionPlan plan=planById.get(society.getSubscriptionPlanId());String health=open>10||rate<60&& !sb.isEmpty()?"Needs attention":open>3||rate<85&& !sb.isEmpty()?"Watch":"Healthy";Map<String,Object> row=new LinkedHashMap<>();row.put("society",society.getSocietyName());row.put("plan",plan==null?"Unassigned":plan.getName());row.put("activeUsers",users.findByTenantId(id).stream().filter(u->!u.isAccountLocked()).count());row.put("collectionRate",round(rate));row.put("openRequests",open);row.put("health",health);return row;}
    private List<Map<String,Object>> revenueTrend(List<MaintenanceBill> source){Map<YearMonth,BigDecimal>billed=new HashMap<>(),collected=new HashMap<>();for(MaintenanceBill bill:source){if(bill.getCreatedAt()==null)continue;YearMonth month=YearMonth.from(bill.getCreatedAt());billed.merge(month,value(bill.getTotalAmount()),BigDecimal::add);if("PAID".equalsIgnoreCase(bill.getPaymentStatus()))collected.merge(month,value(bill.getTotalAmount()),BigDecimal::add);}List<Map<String,Object>> rows=new ArrayList<>();YearMonth now=YearMonth.now();for(int i=5;i>=0;i--){YearMonth month=now.minusMonths(i);Map<String,Object>row=new LinkedHashMap<>();row.put("month",month.getMonth().getDisplayName(TextStyle.SHORT,Locale.ENGLISH));row.put("billed",billed.getOrDefault(month,BigDecimal.ZERO));row.put("collected",collected.getOrDefault(month,BigDecimal.ZERO));rows.add(row);}return rows;}
    private List<Map<String,String>> recommendations(List<Tenant> societies,List<MaintenanceBill> realBills,List<Complaint> realComplaints){List<Map<String,String>>rows=new ArrayList<>();long unpaid=realBills.stream().filter(b->!"PAID".equalsIgnoreCase(b.getPaymentStatus())).count(),open=realComplaints.stream().filter(c->!List.of("RESOLVED","CLOSED").contains(String.valueOf(c.getStatus()).toUpperCase())).count(),unassigned=societies.stream().filter(s->s.getSubscriptionPlanId()==null).count();if(unpaid>0)rows.add(Map.of("title","Review pending collections","detail",unpaid+" bill(s) require society-admin follow-up.","level","warning"));if(open>0)rows.add(Map.of("title","Review open service requests","detail",open+" complaint(s) remain open across registered societies.","level","primary"));if(unassigned>0)rows.add(Map.of("title","Assign subscription plans","detail",unassigned+" society workspace(s) do not have a subscription plan.","level","info"));return rows;}
    private boolean real(Tenant t){return t!=null&&!demo(t.getTenantId())&&!"green-heights".equalsIgnoreCase(t.getCode());}private boolean demo(String id){return "green-heights".equalsIgnoreCase(id);}private BigDecimal value(BigDecimal v){return v==null?BigDecimal.ZERO:v;}private double round(double v){return BigDecimal.valueOf(v).setScale(1,RoundingMode.HALF_UP).doubleValue();}
}
