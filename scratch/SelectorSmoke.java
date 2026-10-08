import java.nio.channels.Selector;
public class SelectorSmoke {
    public static void main(String[] args) throws Exception {
        try (var selector = Selector.open()) {
            System.out.println("Windows selector ready: " + selector.isOpen());
        }
    }
}
