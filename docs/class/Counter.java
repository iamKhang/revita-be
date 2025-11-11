import java.time.LocalDateTime;
import java.util.List;

public class Counter {
    private String id;
    private String counterCode;
    private String counterName;
    private String location;
    private boolean isActive;
    private int maxQueue;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String receptionistId;
    
    // Quan hệ nhiều-một
    private Receptionist receptionist;
    
    // Quan hệ một-nhiều
    private List<CounterAssignment> assignments;
    
    public Counter() {
    }
}

