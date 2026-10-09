import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class ResetApp {
    public static void main(String[] args) throws Exception {
        Class.forName("org.h2.Driver");
        try (Connection conn = DriverManager.getConnection("jdbc:h2:file:./data/smartsociety;AUTO_SERVER=TRUE", "sa", "");
             Statement stmt = conn.createStatement()) {
            int deleted = stmt.executeUpdate("DELETE FROM property_seller_applications WHERE customer_id = 34");
            System.out.println("Deleted applications for customer 34: " + deleted);
        }
    }
}
